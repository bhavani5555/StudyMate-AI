
import { useRef, useState } from "react";

import {
  Sparkles,
  Trophy,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  LoaderCircle,
  BookOpen,
  ClipboardCheck,
  Layers
} from "lucide-react";

import { generateAIResponse } from "../services/aiService";
import { saveQuizToCloud } from "../services/quizService";

import "./QuizGenerator.css";

/* =========================================
   JSON EXTRACTION
========================================= */

const extractJSON = (response) => {
  if (typeof response !== "string" || !response.trim()) {
    throw new Error("Gemini returned an empty response.");
  }

  const cleaned = response
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) {
    throw new Error("Gemini returned an invalid JSON response.");
  }

  try {
    return JSON.parse(cleaned.substring(start, end + 1));
  } catch {
    throw new Error("Gemini returned malformed JSON. Please try again.");
  }
};

/* =========================================
   ANSWER NORMALIZATION
========================================= */

const getAnswerIndex = (answer, options) => {
  if (Number.isInteger(answer)) {
    return answer;
  }

  if (typeof answer === "string") {
    const value = answer.trim();

    if (/^\d+$/.test(value)) {
      return Number(value);
    }

    if (/^[A-D]$/i.test(value)) {
      return value.toUpperCase().charCodeAt(0) - 65;
    }

    return options.findIndex(
      (option) => option.toLowerCase() === value.toLowerCase()
    );
  }

  return -1;
};

/* =========================================
   QUESTION VALIDATION
========================================= */

const prepareQuestions = (response, questionCount, questionType) => {
  const parsed = extractJSON(response);

  const rawQuestions = Array.isArray(parsed)
    ? parsed
    : parsed.questions || parsed.quiz || parsed.data?.questions;

  if (!Array.isArray(rawQuestions)) {
    throw new Error("Gemini did not return a valid questions array.");
  }

  if (rawQuestions.length !== questionCount) {
    throw new Error(
      `Expected ${questionCount} questions but received ${rawQuestions.length}.`
    );
  }

  const expectedOptions = questionType === "MCQ" ? 4 : 2;

  return rawQuestions.map((item) => {
    if (!item || typeof item !== "object") {
      throw new Error("Gemini returned an invalid question.");
    }

    const questionText = item.question || item.questionText;
    const rawOptions = item.options || item.choices;

    if (
      typeof questionText !== "string" ||
      !questionText.trim()
    ) {
      throw new Error("A question is missing its question text.");
    }

    if (!Array.isArray(rawOptions)) {
      throw new Error("A question has an invalid options format.");
    }

    const options = rawOptions.map((option) => {
      if (typeof option === "string") {
        return option.trim();
      }

      if (typeof option === "number") {
        return String(option);
      }

      return "";
    });

    if (
      options.length !== expectedOptions ||
      options.some((option) => !option)
    ) {
      throw new Error(
        questionType === "MCQ"
          ? "Every MCQ question must contain exactly four valid options."
          : "Every True / False question must contain exactly two valid options."
      );
    }

    let correctAnswer;

    if (questionType === "True / False") {
      const normalizedOptions = options.map((option) =>
        option.toLowerCase()
      );

      if (
        !normalizedOptions.includes("true") ||
        !normalizedOptions.includes("false")
      ) {
        throw new Error(
          "True / False options must contain True and False."
        );
      }

      const rawAnswer = item.answer ?? item.correctAnswer;

      if (
        typeof rawAnswer === "string" &&
        ["true", "false"].includes(rawAnswer.trim().toLowerCase())
      ) {
        correctAnswer =
          rawAnswer.trim().toLowerCase() === "true" ? 0 : 1;
      } else {
        const originalIndex = getAnswerIndex(rawAnswer, options);

        if (originalIndex < 0 || originalIndex >= 2) {
          throw new Error("A True / False question has an invalid answer.");
        }

        const originalAnswer = normalizedOptions[originalIndex];

        correctAnswer = originalAnswer === "true" ? 0 : 1;
      }

      return {
        question: questionText.trim(),
        options: ["True", "False"],
        answer: correctAnswer,
        explanation:
          typeof item.explanation === "string"
            ? item.explanation.trim()
            : ""
      };
    }

    correctAnswer = getAnswerIndex(
      item.answer ?? item.correctAnswer,
      options
    );

    if (
      correctAnswer < 0 ||
      correctAnswer >= expectedOptions
    ) {
      throw new Error("An MCQ question has an invalid correct answer.");
    }

    return {
      question: questionText.trim(),
      options,
      answer: correctAnswer,
      explanation:
        typeof item.explanation === "string"
          ? item.explanation.trim()
          : ""
    };
  });
};

/* =========================================
   QUIZ GENERATOR COMPONENT
========================================= */

function QuizGenerator() {
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("Easy");
  const [questionType, setQuestionType] = useState("MCQ");
  const [questionCount, setQuestionCount] = useState("5");

  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [page, setPage] = useState("config");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [generatedQuizzes, setGeneratedQuizzes] = useState(0);
  const [completedQuizzes, setCompletedQuizzes] = useState(0);

  // Prevent multiple simultaneous requests.
  const generationLockRef = useRef(false);
  const submissionLockRef = useRef(false);

  // Preserve the exact completed quiz payload when saving fails.
  const completedQuizRef = useRef(null);

  /* =========================================
     GENERATE QUIZ
  ========================================= */

  const handleStartQuiz = async (e) => {
    e.preventDefault();

    if (generationLockRef.current) return;

    const selectedTopic = topic.trim();

    if (!selectedTopic) {
      setError("Please enter a topic for your quiz.");
      return;
    }

    generationLockRef.current = true;

    setLoading(true);
    setError("");

    const count = Number(questionCount);

    const typeInstruction =
      questionType === "MCQ"
        ? `
- Every question MUST have exactly FOUR options.
- NEVER generate True/False questions.
- All four options must be meaningful and distinct.
- The answer must be a zero-based integer from 0 to 3.
`
        : `
- Every question MUST be a True/False question.
- Every question MUST have exactly TWO options.
- Options MUST be ["True", "False"].
- The answer must be 0 for True or 1 for False.
`;

    const prompt = `
You are a professional educational quiz generator.

Generate exactly ${count} questions about: ${selectedTopic}

Difficulty: ${difficulty}
Question Type: ${questionType}

STRICT RULES:
${typeInstruction}

Additional rules:
1. Generate accurate and relevant questions.
2. Do not repeat questions.
3. Do not include explanations.
4. Keep questions and options concise.
5. Return exactly ${count} questions.
6. Return ONLY valid JSON.
7. Do not include Markdown or code fences.

Required JSON structure:

{
  "questions": [
    {
      "question": "What is Java?",
      "options": [
        "Programming language",
        "Operating system",
        "Database",
        "Web browser"
      ],
      "answer": 0
    }
  ]
}
`;

    try {
      let generatedQuestions = null;
      let lastError = null;

      // Retry once if the response is invalid.
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const retryPrompt =
            attempt === 1
              ? prompt
              : `${prompt}

IMPORTANT:
Your previous response did not follow the required format.
Generate a completely new quiz.
Strictly follow all question and option requirements.
Return only valid JSON.`;

          const response = await generateAIResponse(retryPrompt);

          generatedQuestions = prepareQuestions(
            response,
            count,
            questionType
          );

          break;
        } catch (err) {
          console.error(`Quiz generation attempt ${attempt} failed:`, err);
          lastError = err;
        }
      }

      if (!generatedQuestions) {
        throw lastError || new Error("Unable to generate a valid quiz.");
      }

      setQuestions(generatedQuestions);
      setGeneratedQuizzes((previous) => previous + 1);

      setAnswers({});
      setCurrentQuestion(0);
      setError("");

      completedQuizRef.current = null;

      setPage("quiz");
    } catch (err) {
      console.error("Quiz Generation Error:", err);

      setError(
        err.message || "Unable to generate quiz. Please try again."
      );
    } finally {
      generationLockRef.current = false;
      setLoading(false);
    }
  };

  /* =========================================
     SELECT ANSWER
  ========================================= */

  const handleAnswer = (optionIndex) => {
    if (saving) return;

    setAnswers((previous) => ({
      ...previous,
      [currentQuestion]: optionIndex
    }));
  };

  /* =========================================
     QUIZ SCORE
  ========================================= */

  const correctAnswers = questions.filter(
    (question, index) =>
      answers[index] === question.answer
  ).length;

  const wrongAnswers = questions.length - correctAnswers;

  const percentage = questions.length
    ? Math.round((correctAnswers / questions.length) * 100)
    : 0;

  const answeredCount = Object.keys(answers).length;

  /* =========================================
     SAVE COMPLETED QUIZ
  ========================================= */

  const handleSubmitQuiz = async () => {
    if (
      submissionLockRef.current ||
      saving ||
      questions.length === 0
    ) {
      return;
    }

    submissionLockRef.current = true;

    setSaving(true);
    setError("");

    try {
      // Reuse the same payload when retrying a failed save.
      if (!completedQuizRef.current) {
        completedQuizRef.current = {
          topic: topic.trim(),
          difficulty,
          questionType,
          questionCount: questions.length,
          correctAnswers,
          wrongAnswers,
          percentage,
          answers: { ...answers },

          questions: questions.map((question, index) => ({
            ...question,
            userAnswer: answers[index] ?? null,
            isCorrect: answers[index] === question.answer
          })),

          createdAt: new Date().toISOString()
        };
      }

      await saveQuizToCloud(completedQuizRef.current);

      setCompletedQuizzes((previous) => previous + 1);

      setError("");
      setPage("result");
    } catch (err) {
      console.error("Quiz Saving Error:", err);

      setError(
        "Your quiz is completed, but it could not be saved to the cloud. Please try again."
      );
    } finally {
      submissionLockRef.current = false;
      setSaving(false);
    }
  };

  /* =========================================
     RESTART QUIZ
  ========================================= */

  const handleRetake = () => {
    if (saving || submissionLockRef.current) return;

    setAnswers({});
    setQuestions([]);
    setCurrentQuestion(0);
    setError("");

    completedQuizRef.current = null;

    setPage("config");
  };

  /* =========================================
     NAVIGATION
  ========================================= */

  const goToPreviousQuestion = () => {
    if (currentQuestion > 0 && !saving) {
      setCurrentQuestion((previous) => previous - 1);
      setError("");
    }
  };

  const goToNextQuestion = () => {
    if (
      currentQuestion < questions.length - 1 &&
      !saving
    ) {
      setCurrentQuestion((previous) => previous + 1);
      setError("");
    }
  };

  /* =========================================
     RENDER
  ========================================= */

  return (
    <div className="quiz-page">

      {/* PAGE HEADER */}

      <div className="quiz-header">
        <div className="quiz-header-icon">
          <Sparkles size={25} />
        </div>

        <div>
          <h1>Quiz Generator</h1>
          <p>
            Test your knowledge and improve your learning
            with interactive AI-powered quizzes.
          </p>
        </div>
      </div>

      {/* CONFIGURATION PAGE */}

      {page === "config" && (
        <>
          <section className="quiz-overview">
            <div className="quiz-section-heading">
              <div>
                <h2>Your Learning Overview</h2>
                <p>Track your quiz practice and progress.</p>
              </div>
            </div>

            <div className="quiz-stats-grid">

              <div className="quiz-stat-card">
                <div className="quiz-stat-icon topics">
                  <Layers size={21} />
                </div>

                <div>
                  <span>Topic Selection</span>
                  <strong>Any</strong>
                  <small>Choose any subject you want</small>
                </div>
              </div>

              <div className="quiz-stat-card">
                <div className="quiz-stat-icon generated">
                  <BookOpen size={21} />
                </div>

                <div>
                  <span>Quizzes Generated</span>
                  <strong>{generatedQuizzes}</strong>
                  <small>Created during this session</small>
                </div>
              </div>

              <div className="quiz-stat-card">
                <div className="quiz-stat-icon completed">
                  <ClipboardCheck size={21} />
                </div>

                <div>
                  <span>Quizzes Completed</span>
                  <strong>{completedQuizzes}</strong>
                  <small>Successfully saved quizzes</small>
                </div>
              </div>

            </div>
          </section>

          {/* QUIZ CONFIGURATION */}

          <section className="quiz-config-card">

            <div className="quiz-config-heading">
              <div className="quiz-config-icon">
                <Sparkles size={21} />
              </div>

              <div>
                <h2>Create Your Quiz</h2>
                <p>
                  Customize your quiz and let AI prepare questions
                  based on your learning goals.
                </p>
              </div>
            </div>

            <form onSubmit={handleStartQuiz}>

              <div className="quiz-form-group">
                <label htmlFor="quiz-topic">
                  Enter Your Topic
                </label>

                <input
                  id="quiz-topic"
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Generate a quiz on Java OOP concepts"
                  maxLength={160}
                  autoComplete="off"
                  disabled={loading}
                  required
                />

                <small className="quiz-topic-hint">
                  Enter any subject or specific concept you want to practice.
                </small>
              </div>

              <div className="quiz-options-grid">

                <div className="quiz-form-group">
                  <label htmlFor="quiz-difficulty">
                    Difficulty Level
                  </label>

                  <select
                    id="quiz-difficulty"
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    disabled={loading}
                  >
                    <option>Easy</option>
                    <option>Medium</option>
                    <option>Hard</option>
                  </select>
                </div>

                <div className="quiz-form-group">
                  <label htmlFor="quiz-type">
                    Question Type
                  </label>

                  <select
                    id="quiz-type"
                    value={questionType}
                    onChange={(e) => setQuestionType(e.target.value)}
                    disabled={loading}
                  >
                    <option>MCQ</option>
                    <option>True / False</option>
                  </select>
                </div>

              </div>

              <div className="quiz-form-group">
                <label htmlFor="quiz-count">
                  Number of Questions
                </label>

                <select
                  id="quiz-count"
                  value={questionCount}
                  onChange={(e) => setQuestionCount(e.target.value)}
                  disabled={loading}
                >
                  <option value="5">5 Questions</option>
                  <option value="10">10 Questions</option>
                  <option value="15">15 Questions</option>
                  <option value="20">20 Questions</option>
                  <option value="25">25 Questions</option>
                </select>
              </div>

              {error && (
                <p className="quiz-error-message" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="start-quiz-btn"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <LoaderCircle size={19} className="spin" />
                    Generating Quiz...
                  </>
                ) : (
                  <>
                    <Sparkles size={19} />
                    Generate Quiz
                  </>
                )}
              </button>

            </form>
          </section>
        </>
      )}

      {/* QUIZ QUESTIONS */}

      {page === "quiz" && questions.length > 0 && (
        <div className="quiz-container">

          <div className="quiz-top-bar">
            <span className="quiz-topic">{topic}</span>

            <span className="quiz-counter">
              Question {currentQuestion + 1} of {questions.length}
            </span>
          </div>

          <div
            className="quiz-progress-track"
            role="progressbar"
            aria-valuenow={currentQuestion + 1}
            aria-valuemin={1}
            aria-valuemax={questions.length}
            aria-label="Quiz progress"
          >
            <div
              className="quiz-progress-fill"
              style={{
                width: `${((currentQuestion + 1) / questions.length) * 100}%`
              }}
            />
          </div>

          <h2 className="quiz-question">
            {questions[currentQuestion].question}
          </h2>

          <div className="quiz-answer-list">
            {questions[currentQuestion].options.map(
              (option, index) => (
                <button
                  type="button"
                  key={`${currentQuestion}-${index}`}
                  className={`quiz-answer-option ${
                    answers[currentQuestion] === index
                      ? "selected"
                      : ""
                  }`}
                  onClick={() => handleAnswer(index)}
                  disabled={saving}
                  aria-pressed={answers[currentQuestion] === index}
                >
                  <span className="option-letter">
                    {questionType === "MCQ"
                      ? String.fromCharCode(65 + index)
                      : index === 0
                        ? "T"
                        : "F"}
                  </span>

                  <span className="quiz-option-text">
                    {option}
                  </span>
                </button>
              )
            )}
          </div>

          <div className="quiz-navigation">

            <button
              type="button"
              className="quiz-nav-btn"
              disabled={currentQuestion === 0 || saving}
              onClick={goToPreviousQuestion}
            >
              <ArrowLeft size={16} />
              Previous
            </button>

            {currentQuestion < questions.length - 1 ? (
              <button
                type="button"
                className="quiz-nav-btn primary"
                disabled={saving}
                onClick={goToNextQuestion}
              >
                Next
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="quiz-nav-btn primary"
                disabled={saving}
                onClick={handleSubmitQuiz}
              >
                {saving ? (
                  <>
                    <LoaderCircle size={16} className="spin" />
                    Saving Quiz...
                  </>
                ) : (
                  <>
                    Submit Quiz
                    <Trophy size={16} />
                  </>
                )}
              </button>
            )}

          </div>

          <div className="quiz-answer-progress">
            {answeredCount} of {questions.length} questions answered
          </div>

          {error && (
            <p className="quiz-error-message" role="alert">
              {error}
            </p>
          )}

        </div>
      )}

      {/* QUIZ RESULTS */}

      {page === "result" && (
        <div className="quiz-result-card">

          <div className="quiz-result-icon">
            <Trophy size={38} />
          </div>

          <h2>Quiz Completed!</h2>

          <p>
            Great job! Here is your quiz performance.
          </p>

          <div className="quiz-score">
            {percentage}%
          </div>

          <p className="quiz-score-label">
            Your Overall Score
          </p>

          <div className="quiz-result-details">

            <div className="quiz-result-item">
              <strong>{correctAnswers}</strong>
              <span>Correct Answers</span>
            </div>

            <div className="quiz-result-item">
              <strong>{wrongAnswers}</strong>
              <span>Wrong Answers</span>
            </div>

            <div className="quiz-result-item">
              <strong>{questions.length}</strong>
              <span>Total Questions</span>
            </div>

          </div>

          <button
            type="button"
            className="retake-quiz-btn"
            onClick={handleRetake}
          >
            <RotateCcw size={18} />
            Create Another Quiz
          </button>

        </div>
      )}

    </div>
  );
}

export default QuizGenerator;
