
import { useState } from "react";

import {
  Layers,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Shuffle,
  CheckCircle,
  BookOpen,
  Brain,
  LoaderCircle,
  Trophy,
  Target,
  RefreshCw,
  GraduationCap,
  ClipboardCheck
} from "lucide-react";

import { generateAIResponse } from "../services/aiService";
import { saveFlashcardToCloud } from "../services/flashcardService";

import "./Flashcards.css";

const VALID_COUNTS = [5, 10, 15, 20, 25];

const extractJSON = (response) => {
  if (typeof response !== "string" || !response.trim()) {
    throw new Error("The AI returned an empty response.");
  }

  const cleaned = response
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) {
    throw new Error(
      "The AI returned an invalid flashcard response. Please try again."
    );
  }

  try {
    return JSON.parse(cleaned.substring(start, end + 1));
  } catch {
    throw new Error(
      "Could not read the generated flashcards. Please try again."
    );
  }
};

const prepareFlashcards = (parsed, expectedCount) => {
  const rawCards = Array.isArray(parsed)
    ? parsed
    : parsed.flashcards || parsed.cards || parsed.data?.flashcards;

  if (!Array.isArray(rawCards)) {
    throw new Error("The AI did not return a valid flashcard list.");
  }

  if (rawCards.length < expectedCount) {
    throw new Error(
      `The AI generated ${rawCards.length} cards instead of ${expectedCount}. Please try again.`
    );
  }

  return rawCards.slice(0, expectedCount).map((card, index) => {
    const question = card?.question || card?.front;
    const answer = card?.answer || card?.back;

    if (
      typeof question !== "string" ||
      !question.trim() ||
      typeof answer !== "string" ||
      !answer.trim()
    ) {
      throw new Error(`Flashcard ${index + 1} has incomplete content.`);
    }

    return {
      id: index,
      question: question.trim(),
      answer: answer.trim()
    };
  });
};

function LibraryIcon() {
  return <BookOpen size={22} />;
}

function Flashcards() {
  const [request, setRequest] = useState("");
  const [difficulty, setDifficulty] = useState("Medium");
  const [questionCount, setQuestionCount] = useState("10");

  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const [knownCards, setKnownCards] = useState([]);
  const [practiceCards, setPracticeCards] = useState([]);

  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [generatedCardsTotal, setGeneratedCardsTotal] = useState(0);
  const [deckTitle, setDeckTitle] = useState("");

  const currentCard = cards[currentIndex];

  const reviewedCount = knownCards.length + practiceCards.length;

  const progress = cards.length
    ? Math.round((reviewedCount / cards.length) * 100)
    : 0;

  // =========================================
  // GENERATE FLASHCARDS
  // =========================================

  const handleGenerateFlashcards = async (e) => {
    e.preventDefault();

    if (loading) return;

    const userRequest = request.trim();
    const count = Number(questionCount);

    if (!userRequest) {
      setError("Please describe what you want to learn or practice.");
      return;
    }

    if (userRequest.length < 3) {
      setError("Please enter a more detailed learning request.");
      return;
    }

    if (userRequest.length > 1500) {
      setError("Please keep your request under 1500 characters.");
      return;
    }

    if (!VALID_COUNTS.includes(count)) {
      setError("Please select a valid number of flashcards.");
      return;
    }

    setLoading(true);
    setError("");

    const prompt = `
You are an expert educational tutor and flashcard creator.

The student has provided the following request:

"${userRequest}"

Understand the student's intent carefully.

The request may be:
- A topic or concept.
- A programming language or API.
- An exam preparation request.
- An interview preparation request.
- A request covering multiple related concepts.

Identify the correct subject and learning purpose.

Create EXACTLY ${count} useful flashcards.

Difficulty level: ${difficulty}

DIFFICULTY REQUIREMENTS:

Easy:
- Test basic definitions and fundamental concepts.
- Use simple, beginner-friendly language.
- Focus on foundational knowledge.

Medium:
- Test conceptual understanding and practical knowledge.
- Include differences, use cases, and examples where useful.
- Suitable for college exams and fresher interviews.

Hard:
- Test deeper understanding and application.
- Include tricky concepts, edge cases, and scenario-based questions.
- Avoid unnecessarily confusing questions.

FLASHCARD REQUIREMENTS:

1. Generate exactly ${count} flashcards.
2. Every question must be relevant to the student's request.
3. Cover different important subtopics.
4. Each question must test one clear concept.
5. Answers must be technically accurate.
6. Keep answers clear, concise, and useful for revision.
7. Include short examples when useful.
8. For exam preparation, prioritize important exam concepts.
9. For interview preparation, include practical questions.
10. Do not invent facts, APIs, syntax, or technical behavior.
11. Do not include duplicate or nearly duplicate questions.
12. Return ONLY valid JSON.
13. Do not include Markdown or explanations outside JSON.

REQUIRED JSON FORMAT:

{
  "title": "A short and meaningful deck title",
  "flashcards": [
    {
      "question": "What is a Java data type?",
      "answer": "A data type specifies the kind of value a variable can store."
    }
  ]
}

The flashcards array MUST contain exactly ${count} complete objects.
`;

    let generatedCards;

    let generatedTitle;

    // Step 1: Generate and validate cards.

    try {
      const response = await generateAIResponse(prompt);

      const parsedResponse = extractJSON(response);

      generatedCards = prepareFlashcards(parsedResponse, count);

      generatedTitle =
        typeof parsedResponse.title === "string" &&
        parsedResponse.title.trim()
          ? parsedResponse.title.trim()
          : userRequest;

    } catch (err) {
      console.error("Flashcard Generation Error:", err);

      setError(
        err.message || "Unable to generate flashcards. Please try again."
      );

      setLoading(false);
      return;
    }

    // Step 2: Display the generated deck immediately.

    setDeckTitle(generatedTitle);
    setGeneratedCardsTotal((previous) => previous + generatedCards.length);

    setCards(generatedCards);
    setCurrentIndex(0);
    setIsFlipped(false);

    setKnownCards([]);
    setPracticeCards([]);

    setCompleted(false);
    setStarted(true);

    // Step 3: Save the generated deck to Firebase.

    const newFlashcardSet = {
      topic: generatedTitle,
      request: userRequest,
      difficulty,
      cardCount: generatedCards.length,
      cards: generatedCards,
      createdAt: new Date().toISOString()
    };

    try {
      await saveFlashcardToCloud(newFlashcardSet);
    } catch (err) {
      console.error("Flashcard Cloud Save Error:", err);

      setError(
        "Your flashcards were generated successfully, but cloud saving failed. You can still use this deck."
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================
  // FLIP CARD
  // =========================================

  const handleFlip = () => {
    if (!currentCard) return;

    setIsFlipped((previous) => !previous);
  };

  // =========================================
  // NAVIGATION
  // =========================================

  const handleNext = () => {
    if (currentIndex >= cards.length - 1) return;

    setCurrentIndex((previous) => previous + 1);
    setIsFlipped(false);
  };

  const handlePrevious = () => {
    if (currentIndex <= 0) return;

    setCurrentIndex((previous) => previous - 1);
    setIsFlipped(false);
  };

  // =========================================
  // MARK AS KNOWN
  // =========================================

  const handleKnown = () => {
    if (!currentCard) return;

    const cardId = currentCard.id;

    setKnownCards((previous) =>
      previous.includes(cardId)
        ? previous
        : [...previous, cardId]
    );

    setPracticeCards((previous) =>
      previous.filter((id) => id !== cardId)
    );
  };

  // =========================================
  // MARK FOR PRACTICE
  // =========================================

  const handlePractice = () => {
    if (!currentCard) return;

    const cardId = currentCard.id;

    setPracticeCards((previous) =>
      previous.includes(cardId)
        ? previous
        : [...previous, cardId]
    );

    setKnownCards((previous) =>
      previous.filter((id) => id !== cardId)
    );
  };

  // =========================================
  // SHUFFLE CARDS
  // =========================================

  const handleShuffle = () => {
    if (cards.length < 2) return;

    const shuffled = [...cards];

    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));

      [shuffled[i], shuffled[j]] = [
        shuffled[j],
        shuffled[i]
      ];
    }

    setCards(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  // =========================================
  // RESTART SESSION
  // =========================================

  const handleRestart = () => {
    setCurrentIndex(0);
    setIsFlipped(false);

    setKnownCards([]);
    setPracticeCards([]);

    setCompleted(false);
    setError("");
  };

  // =========================================
  // FINISH SESSION
  // =========================================

  const handleFinish = () => {
    setCompleted(true);
    setIsFlipped(false);
  };

  // =========================================
  // CREATE NEW DECK
  // =========================================

  const handleCreateNewSet = () => {
    setRequest("");
    setDifficulty("Medium");
    setQuestionCount("10");

    setStarted(false);
    setCompleted(false);

    setCards([]);
    setCurrentIndex(0);
    setIsFlipped(false);

    setKnownCards([]);
    setPracticeCards([]);

    setDeckTitle("");
    setGeneratedCardsTotal(0);
    setError("");
  };

  return (
    <div className="flashcards-page">

      {/* PAGE HEADER */}

      <div className="flashcards-header">
        <div className="flashcards-header-main">
          <div className="flashcards-header-icon">
            <Layers size={27} />
          </div>

          <div>
            <span className="flashcards-eyebrow">
              SMART LEARNING EXPERIENCE
            </span>

            <h1>Flashcards</h1>

            <p>
              Tell AI what you want to learn. Create a personalized study deck.
            </p>
          </div>
        </div>

        {started && !completed && (
          <div className="flashcards-header-actions">
            <button
              type="button"
              className="shuffle-btn"
              onClick={handleShuffle}
              disabled={cards.length < 2}
            >
              <Shuffle size={17} />
              Shuffle
            </button>

            <button
              type="button"
              className="new-flashcards-btn"
              onClick={handleCreateNewSet}
            >
              <Sparkles size={17} />
              New Set
            </button>
          </div>
        )}
      </div>

      {/* LEARNING OVERVIEW */}

      <section className="flashcards-overview">
        <div className="flashcards-overview-heading">
          <div>
            <h2>Your Learning Overview</h2>
            <p>Track your flashcard learning activity.</p>
          </div>
        </div>

        <div className="flashcards-stats">

          <div className="flash-stat-card">
            <div className="flash-stat-icon topics-icon">
              <LibraryIcon />
            </div>

            <div className="flash-stat-info">
              <h3>{cards.length}</h3>
              <p>Cards in Current Deck</p>
            </div>
          </div>

          <div className="flash-stat-card">
            <div className="flash-stat-icon generated-icon">
              <Layers size={22} />
            </div>

            <div className="flash-stat-info">
              <h3>{generatedCardsTotal}</h3>
              <p>Cards Generated</p>
            </div>
          </div>

          <div className="flash-stat-card">
            <div className="flash-stat-icon completed-icon">
              <ClipboardCheck size={22} />
            </div>

            <div className="flash-stat-info">
              <h3>{reviewedCount}</h3>
              <p>Cards Reviewed</p>
            </div>
          </div>

        </div>
      </section>

      {/* DECK CONFIGURATION */}

      {!started && (
        <section className="flashcards-config-card">

          <div className="flashcards-section-heading">
            <div className="config-icon">
              <Sparkles size={24} />
            </div>

            <div>
              <span className="section-eyebrow">AI DECK GENERATOR</span>
              <h2>What Do You Want to Learn?</h2>
              <p>
                Describe any topic, concept, or exam preparation goal in your own words.
              </p>
            </div>
          </div>

          <form onSubmit={handleGenerateFlashcards}>

            <div className="flashcards-form-group">
              <label htmlFor="flashcard-request">
                Your Learning Request
              </label>

              <input
                id="flashcard-request"
                type="text"
                className="flashcards-request-input"
                value={request}
                onChange={(e) => {
                  setRequest(e.target.value);
                  if (error) setError("");
                }}
                disabled={loading}
                maxLength={1500}
                placeholder="e.g. Generate flashcards on Java OOP concepts"
              />

              <div className="flashcards-input-footer">
                <span>Be specific about what you want to practice.</span>
                <span>{request.length}/1500</span>
              </div>
            </div>

            <div className="flashcards-form-grid">

              <div className="flashcards-form-group">
                <label htmlFor="flashcard-difficulty">
                  Difficulty Level
                </label>

                <select
                  id="flashcard-difficulty"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  disabled={loading}
                >
                  <option value="Easy">Easy - Beginner</option>
                  <option value="Medium">Medium - Intermediate</option>
                  <option value="Hard">Hard - Advanced</option>
                </select>
              </div>

              <div className="flashcards-form-group">
                <label htmlFor="flashcard-count">
                  Number of Flashcards
                </label>

                <select
                  id="flashcard-count"
                  value={questionCount}
                  onChange={(e) => setQuestionCount(e.target.value)}
                  disabled={loading}
                >
                  {VALID_COUNTS.map((count) => (
                    <option key={count} value={String(count)}>
                      {count} Cards
                    </option>
                  ))}
                </select>
              </div>

            </div>

            {error && (
              <p className="flashcards-error-message" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="generate-flashcards-btn"
              disabled={loading || !request.trim()}
            >
              {loading ? (
                <>
                  <LoaderCircle size={19} className="flashcards-spin" />
                  Generating Your Flashcards...
                </>
              ) : (
                <>
                  <Sparkles size={19} />
                  Generate Flashcards
                </>
              )}
            </button>

          </form>
        </section>
      )}

      {/* GENERATED DECK */}

      {started && (
        <>

          <section className="flashcards-topic">
            <div className="topic-icon">
              <GraduationCap size={25} />
            </div>

            <div className="flashcards-topic-info">
              <span>YOUR STUDY DECK</span>
              <h2>{deckTitle}</h2>

              <p className="flashcards-difficulty">
                {difficulty} Level <span>·</span> {cards.length} Cards
              </p>
            </div>
          </section>

          {!completed && (
            <>

              {error && (
                <p className="flashcards-error-message" role="alert">
                  {error}
                </p>
              )}

              <section className="flashcards-progress">
                <div className="progress-heading">
                  <div>
                    <h3>Your Review Progress</h3>
                    <p>{reviewedCount} of {cards.length} cards reviewed</p>
                  </div>

                  <strong>{progress}%</strong>
                </div>

                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </section>

              <section className="flashcard-section">

                <div className="flashcard-top">
                  <div>
                    <span className="section-eyebrow">ACTIVE STUDY CARD</span>
                    <h3>Test Your Knowledge</h3>
                  </div>

                  <span className="card-counter">
                    CARD {currentIndex + 1} <span>/ {cards.length}</span>
                  </span>
                </div>

                <div className="flashcard-scene">

                  <button
                    type="button"
                    className={`flashcard ${isFlipped ? "flipped" : ""}`}
                    onClick={handleFlip}
                    aria-label={
                      isFlipped
                        ? "Show flashcard question"
                        : "Reveal flashcard answer"
                    }
                    aria-pressed={isFlipped}
                  >

                    <div className="flashcard-inner">

                      {!isFlipped ? (

                        <div className="flashcard-face flashcard-front">

                          <span className="flashcard-side-label">
                            <Brain size={15} />
                            QUESTION
                          </span>

                          <div className="flashcard-main-icon">
                            <Brain size={34} />
                          </div>

                          <h2>{currentCard?.question}</h2>

                          <span className="flashcard-bottom-hint">
                            Tap anywhere to reveal answer
                            <RotateCcw size={15} />
                          </span>

                        </div>

                      ) : (

                        <div className="flashcard-face flashcard-back">

                          <span className="flashcard-side-label">
                            <BookOpen size={15} />
                            ANSWER
                          </span>

                          <div className="flashcard-main-icon">
                            <CheckCircle size={34} />
                          </div>

                          <h2>{currentCard?.answer}</h2>

                          <span className="flashcard-bottom-hint">
                            Tap anywhere to see question
                            <RotateCcw size={15} />
                          </span>

                        </div>

                      )}

                    </div>
                  </button>
                </div>

                <p className="flashcard-instruction">
                  Reveal the answer, then mark how well you know this concept.
                </p>

                <div className="flashcard-actions">

                  <button
                    type="button"
                    className={`practice-btn ${
                      practiceCards.includes(currentCard?.id) ? "active" : ""
                    }`}
                    onClick={handlePractice}
                    disabled={!currentCard}
                  >
                    <RefreshCw size={17} />
                    Still Learning
                  </button>

                  <button
                    type="button"
                    className={`known-btn ${
                      knownCards.includes(currentCard?.id) ? "active" : ""
                    }`}
                    onClick={handleKnown}
                    disabled={!currentCard}
                  >
                    <CheckCircle size={17} />
                    I Know This
                  </button>

                </div>

                <div className="flashcard-navigation">

                  <button
                    type="button"
                    className="flash-nav-btn"
                    onClick={handlePrevious}
                    disabled={currentIndex === 0}
                  >
                    <ArrowLeft size={17} />
                    Previous
                  </button>

                  {currentIndex === cards.length - 1 ? (

                    <button
                      type="button"
                      className="flash-nav-btn finish"
                      onClick={handleFinish}
                    >
                      Finish Session
                      <Trophy size={17} />
                    </button>

                  ) : (

                    <button
                      type="button"
                      className="flash-nav-btn next"
                      onClick={handleNext}
                    >
                      Next Card
                      <ArrowRight size={17} />
                    </button>

                  )}

                </div>

                <button
                  type="button"
                  className="restart-btn"
                  onClick={handleRestart}
                >
                  <RotateCcw size={15} />
                  Restart Learning Session
                </button>

              </section>
            </>
          )}

          {completed && (
            <section className="flashcards-completion">

              <div className="completion-icon">
                <Trophy size={39} />
              </div>

              <span className="completion-eyebrow">
                SESSION COMPLETED
              </span>

              <h2>Great Work!</h2>

              <p>
                You have reviewed your {deckTitle} flashcard deck.
              </p>

              <div className="completion-stats">

                <div>
                  <BookOpen size={22} />
                  <strong>{cards.length}</strong>
                  <span>Total Cards</span>
                </div>

                <div>
                  <CheckCircle size={22} />
                  <strong>{knownCards.length}</strong>
                  <span>Known</span>
                </div>

                <div>
                  <Target size={22} />
                  <strong>{practiceCards.length}</strong>
                  <span>Need Practice</span>
                </div>

              </div>

              <div className="completion-progress">

                <div>
                  <span>Cards reviewed</span>
                  <strong>{progress}%</strong>
                </div>

                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>

              </div>

              <div className="completion-actions">

                <button
                  type="button"
                  className="new-flashcards-btn"
                  onClick={handleRestart}
                >
                  <RefreshCw size={17} />
                  Review Again
                </button>

                <button
                  type="button"
                  className="generate-flashcards-btn"
                  onClick={handleCreateNewSet}
                >
                  <Sparkles size={17} />
                  Create New Deck
                </button>

              </div>

            </section>
          )}

        </>
      )}

    </div>
  );
}

export default Flashcards;
