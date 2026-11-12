
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY?.trim();

// Primary model for quality; Flash-Lite as a faster fallback.
const MODELS = [
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite"
];

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_OUTPUT_TOKENS = 8192;

// ========================================
// ERROR HELPERS
// ========================================

const getRetryTime = (message = "") => {
  const match = message.match(
    /Please retry in\s+([\d.]+h(?:[\d.]+m)?(?:[\d.]+s)?|[\d.]+m(?:[\d.]+s)?|[\d.]+s)/i
  );

  return match?.[1] || null;
};

const getFriendlyError = (error) => {
  const message = error.message || "";
  const lowerMessage = message.toLowerCase();

  if (error.status === 429) {
    const isDailyQuota =
      lowerMessage.includes("per day") ||
      lowerMessage.includes("per_day") ||
      lowerMessage.includes("free_tier") ||
      lowerMessage.includes("daily") ||
      lowerMessage.includes("requests per day");

    const retryTime = getRetryTime(message);

    if (isDailyQuota) {
      return (
        "Gemini's daily API quota has been exhausted. " +
        (retryTime
          ? `Please try again after approximately ${retryTime}.`
          : "Please try again after your quota resets.")
      );
    }

    return (
      "Gemini API is temporarily rate-limited. Please wait a little and try again."
    );
  }

  if ([401, 403].includes(error.status)) {
    return "Gemini API authentication failed. Please check your API key and permissions.";
  }

  if (error.status === 400) {
    return "Gemini could not process this request. Please check your prompt and try again.";
  }

  if (error.status === 404) {
    return "The requested Gemini model is unavailable. Please check your model configuration.";
  }

  if (error.status === 408 || error.name === "TimeoutError") {
    return "The AI request took too long. Please try again with a shorter prompt or document.";
  }

  if (error.status >= 500) {
    return "Gemini is temporarily experiencing server issues. Please try again shortly.";
  }

  if (error.name === "TypeError") {
    return "Unable to connect to Gemini. Please check your internet connection.";
  }

  return message || "Something went wrong while generating your response.";
};

// ========================================
// GEMINI API REQUEST
// ========================================

const generateWithModel = async (
  model,
  prompt,
  options = {}
) => {
  const timeoutMs =
    options.timeoutMs ?? DEFAULT_TIMEOUT;

  const maxOutputTokens =
    options.maxOutputTokens ?? DEFAULT_OUTPUT_TOKENS;

  const controller = new AbortController();

  let timedOut = false;

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": API_KEY
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: options.temperature ?? 0.6,
            maxOutputTokens
          }
        }),
        signal: controller.signal
      }
    );

    let data;

    try {
      data = await response.json();
    } catch {
      const error = new Error(
        "Gemini returned an invalid response."
      );

      error.status = response.status;
      throw error;
    }

    if (!response.ok) {
      const error = new Error(
        data.error?.message ||
          `Gemini API failed with HTTP ${response.status}.`
      );

      error.status = response.status;
      error.apiStatus = data.error?.status;
      error.retryAfter = response.headers.get("Retry-After");

      throw error;
    }

    const candidate = data.candidates?.[0];

    const finishReason =
      candidate?.finishReason || "Unknown";

    const answer = candidate?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    if (!answer) {
      const error = new Error(
        `Gemini returned an empty response. Finish reason: ${finishReason}`
      );

      error.status = 200;
      error.finishReason = finishReason;

      throw error;
    }

    if (finishReason === "MAX_TOKENS") {
      const error = new Error(
        "The generated response exceeded the AI output limit. Try a shorter topic or smaller document section."
      );

      error.status = 200;
      error.finishReason = finishReason;

      throw error;
    }

    if (finishReason === "SAFETY") {
      const error = new Error(
        "Gemini could not complete the response because its safety filters blocked the content."
      );

      error.status = 200;
      error.finishReason = finishReason;

      throw error;
    }

    return answer;

  } catch (error) {
    if (timedOut) {
      const timeoutError = new Error(
        `${model} timed out after ${timeoutMs / 1000} seconds.`
      );

      timeoutError.name = "TimeoutError";
      timeoutError.status = 408;

      throw timeoutError;
    }

    throw error;

  } finally {
    clearTimeout(timeoutId);
  }
};

// ========================================
// MAIN AI GENERATION FUNCTION
// ========================================

export const generateAIResponse = async (
  prompt,
  options = {}
) => {
  if (!API_KEY) {
    throw new Error(
      "Gemini API key is missing. Please check your .env file."
    );
  }

  if (
    typeof prompt !== "string" ||
    !prompt.trim()
  ) {
    throw new Error(
      "Please enter a topic or upload a document to generate notes."
    );
  }

  // Fast mode uses only the primary model.
  const models = options.fastMode
    ? MODELS.slice(0, 1)
    : MODELS;

  const requestOptions = {
    timeoutMs:
      options.timeoutMs ?? DEFAULT_TIMEOUT,

    maxOutputTokens:
      options.maxOutputTokens ?? DEFAULT_OUTPUT_TOKENS,

    temperature:
      options.temperature ?? 0.6
  };

  const modelErrors = [];

  // ========================================
  // FAST MODEL FALLBACK
  // One attempt per model by default.
  // No unnecessary 1.5-second waiting.
  // ========================================

  for (const model of models) {
    try {
      console.log(
        `Trying Gemini model: ${model}`
      );

      const answer = await generateWithModel(
        model,
        prompt.trim(),
        requestOptions
      );

      console.log(
        `AI response generated successfully using ${model}`
      );

      return answer;

    } catch (error) {
      const errorDetails = {
        model,
        status: error.status ?? "Network error",
        message: error.message
      };

      console.error(
        "Gemini request failed:",
        errorDetails
      );

      modelErrors.push(error);

      // Stop immediately for quota errors.
      if (error.status === 429) {
        throw new Error(getFriendlyError(error));
      }

      // Stop for invalid request or authentication errors.
      if ([400, 401, 403].includes(error.status)) {
        throw new Error(getFriendlyError(error));
      }

      // Stop for response validation errors.
      if (
        error.status === 200 &&
        error.finishReason
      ) {
        throw new Error(error.message);
      }

      // For temporary server/network errors,
      // immediately try the next model.
      console.warn(
        `Switching to fallback model after ${model} failed.`
      );
    }
  }

  // ========================================
  // FINAL ERROR
  // ========================================

  const lastError =
    modelErrors[modelErrors.length - 1];

  if (
    modelErrors.some((error) => error.status >= 500)
  ) {
    throw new Error(
      "Gemini servers are temporarily busy. Please try again in a little while."
    );
  }

  if (
    modelErrors.some(
      (error) =>
        error.status === 408 ||
        error.name === "TimeoutError"
    )
  ) {
    throw new Error(
      "The AI request timed out. Please try again with a shorter topic or document."
    );
  }

  if (
    modelErrors.some(
      (error) => error.name === "TypeError"
    )
  ) {
    throw new Error(
      "Unable to connect to Gemini. Please check your internet connection."
    );
  }

  throw new Error(
    getFriendlyError(
      lastError || new Error("Unable to generate response.")
    )
  );
};
