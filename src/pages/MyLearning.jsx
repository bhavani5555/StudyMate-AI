import { useCallback, useEffect, useRef, useState } from "react";

import {
  BookOpen,
  FileText,
  Trash2,
  Calendar,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  CheckCircle,
  XCircle,
  Trophy,
  Layers,
  Brain,
  Code,
  Sparkles,
  Filter,
  X,
  RefreshCw
} from "lucide-react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  getCloudNotes,
  deleteCloudNote
} from "../services/notesService";

import {
  getCloudQuizzes,
  deleteCloudQuiz
} from "../services/quizService";

import {
  getCloudFlashcards,
  deleteCloudFlashcard
} from "../services/flashcardService";

import {
  getCloudInterviews,
  deleteCloudInterview
} from "../services/interviewService";

import "./MyLearning.css";

function MyLearning() {
  // =========================================
  // DATA STATES
  // =========================================

  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [notesError, setNotesError] = useState("");

  const [quizzes, setQuizzes] = useState([]);
  const [quizzesLoading, setQuizzesLoading] = useState(true);
  const [quizzesError, setQuizzesError] = useState("");

  const [flashcards, setFlashcards] = useState([]);
  const [flashcardsLoading, setFlashcardsLoading] = useState(true);
  const [flashcardsError, setFlashcardsError] = useState("");

  const [interviews, setInterviews] = useState([]);
  const [interviewsLoading, setInterviewsLoading] = useState(true);
  const [interviewsError, setInterviewsError] = useState("");

  // =========================================
  // EXPANDED ITEM STATES
  // =========================================

  const [expandedNote, setExpandedNote] = useState(null);
  const [expandedQuiz, setExpandedQuiz] = useState(null);
  const [expandedFlashcard, setExpandedFlashcard] = useState(null);
  const [expandedInterview, setExpandedInterview] = useState(null);

  const [activeFilter, setActiveFilter] = useState("all");

  // =========================================
  // DELETE MODAL STATES
  // =========================================

  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    type: "",
    id: null,
    title: "",
    deleting: false
  });

  const [deleteError, setDeleteError] = useState("");

  // Prevent duplicate delete requests.
  const deleteLockRef = useRef(false);

  // =========================================
  // LOAD NOTES
  // =========================================

  const loadNotes = useCallback(async () => {
    try {
      setNotesLoading(true);
      setNotesError("");

      const cloudNotes = await getCloudNotes();

      setNotes(Array.isArray(cloudNotes) ? cloudNotes : []);
    } catch (error) {
      console.error("Error loading cloud notes:", error);
      setNotesError("Unable to load your saved notes. Please try again.");
    } finally {
      setNotesLoading(false);
    }
  }, []);

  // =========================================
  // LOAD QUIZZES
  // =========================================

  const loadQuizzes = useCallback(async () => {
    try {
      setQuizzesLoading(true);
      setQuizzesError("");

      const cloudQuizzes = await getCloudQuizzes();

      setQuizzes(Array.isArray(cloudQuizzes) ? cloudQuizzes : []);
    } catch (error) {
      console.error("Error loading cloud quizzes:", error);
      setQuizzesError("Unable to load your saved quizzes. Please try again.");
    } finally {
      setQuizzesLoading(false);
    }
  }, []);

  // =========================================
  // LOAD FLASHCARDS
  // =========================================

  const loadFlashcards = useCallback(async () => {
    try {
      setFlashcardsLoading(true);
      setFlashcardsError("");

      const cloudFlashcards = await getCloudFlashcards();

      setFlashcards(
        Array.isArray(cloudFlashcards) ? cloudFlashcards : []
      );
    } catch (error) {
      console.error("Error loading cloud flashcards:", error);
      setFlashcardsError(
        "Unable to load your saved flashcards. Please try again."
      );
    } finally {
      setFlashcardsLoading(false);
    }
  }, []);

  // =========================================
  // LOAD INTERVIEWS
  // =========================================

  const loadInterviews = useCallback(async () => {
    try {
      setInterviewsLoading(true);
      setInterviewsError("");

      const cloudInterviews = await getCloudInterviews();

      setInterviews(
        Array.isArray(cloudInterviews) ? cloudInterviews : []
      );
    } catch (error) {
      console.error("Error loading cloud interviews:", error);
      setInterviewsError(
        "Unable to load your interview sessions. Please try again."
      );
    } finally {
      setInterviewsLoading(false);
    }
  }, []);

  // =========================================
  // INITIAL DATA LOADING
  // =========================================

  useEffect(() => {
    loadNotes();
    loadQuizzes();
    loadFlashcards();
    loadInterviews();
  }, [loadNotes, loadQuizzes, loadFlashcards, loadInterviews]);

  // =========================================
  // DELETE MODAL
  // =========================================

  const openDeleteModal = (type, id, title) => {
    if (id === null || id === undefined || deleteLockRef.current) {
      return;
    }

    setDeleteError("");

    setDeleteModal({
      isOpen: true,
      type,
      id,
      title: title || "this item",
      deleting: false
    });
  };

  const closeDeleteModal = () => {
    if (deleteLockRef.current) return;

    setDeleteError("");

    setDeleteModal({
      isOpen: false,
      type: "",
      id: null,
      title: "",
      deleting: false
    });
  };

  // =========================================
  // CONFIRM DELETE
  // =========================================

  const confirmDelete = async () => {
    if (
      deleteModal.id === null ||
      deleteModal.id === undefined ||
      deleteLockRef.current
    ) {
      return;
    }

    const { type, id } = deleteModal;

    deleteLockRef.current = true;
    setDeleteError("");

    setDeleteModal((previous) => ({
      ...previous,
      deleting: true
    }));

    try {
      if (type === "note") {
        await deleteCloudNote(id);

        setNotes((previous) =>
          previous.filter((note) => note.id !== id)
        );

        setExpandedNote((previous) =>
          previous === id ? null : previous
        );
      } else if (type === "quiz") {
        await deleteCloudQuiz(id);

        setQuizzes((previous) =>
          previous.filter((quiz) => quiz.id !== id)
        );

        setExpandedQuiz((previous) =>
          previous === id ? null : previous
        );
      } else if (type === "flashcard") {
        await deleteCloudFlashcard(id);

        setFlashcards((previous) =>
          previous.filter((item) => item.id !== id)
        );

        setExpandedFlashcard((previous) =>
          previous === id ? null : previous
        );
      } else if (type === "interview") {
        await deleteCloudInterview(id);

        setInterviews((previous) =>
          previous.filter((interview) => interview.id !== id)
        );

        setExpandedInterview((previous) =>
          previous === id ? null : previous
        );
      } else {
        throw new Error("Invalid delete type.");
      }

      setDeleteModal({
        isOpen: false,
        type: "",
        id: null,
        title: "",
        deleting: false
      });
    } catch (error) {
      console.error("Error deleting item:", error);

      setDeleteError(
        "Unable to delete this item. Please try again."
      );

      setDeleteModal((previous) => ({
        ...previous,
        deleting: false
      }));
    } finally {
      deleteLockRef.current = false;
    }
  };

  // =========================================
  // DATE FORMATTING
  // =========================================

  const formatDate = (date) => {
    if (!date) return "Date unavailable";

    try {
      let parsedDate;

      if (typeof date?.toDate === "function") {
        parsedDate = date.toDate();
      } else if (typeof date?.seconds === "number") {
        parsedDate = new Date(date.seconds * 1000);
      } else {
        parsedDate = new Date(date);
      }

      if (Number.isNaN(parsedDate.getTime())) {
        return "Date unavailable";
      }

      return parsedDate.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
    } catch {
      return "Date unavailable";
    }
  };

  // =========================================
  // TOGGLE EXPANDED ITEMS
  // =========================================

  const toggleItem = (id, current, setter) => {
    setter(current === id ? null : id);
  };

  // =========================================
  // QUIZ ANSWER HELPERS
  // =========================================

  const getOptionText = (option) => {
    if (option === null || option === undefined) {
      return "";
    }

    if (typeof option === "object") {
      return String(
        option.label ??
        option.text ??
        option.value ??
        option.option ??
        ""
      );
    }

    return String(option);
  };

  const normalizeAnswer = (value) => {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  };

  // Converts an answer into its matching option index.
  // Supports:
  // - Numeric option indexes
  // - A/B/C/D option letters
  // - Exact option text
  // - Objects containing label/text/value
  const getAnswerIndex = (answer, options = []) => {
    if (
      answer === null ||
      answer === undefined ||
      answer === "" ||
      !Array.isArray(options)
    ) {
      return -1;
    }

    if (typeof answer === "object") {
      answer =
        answer.index ??
        answer.optionIndex ??
        answer.label ??
        answer.text ??
        answer.value ??
        answer.answer;
    }

    if (typeof answer === "number" && Number.isInteger(answer)) {
      return answer >= 0 && answer < options.length ? answer : -1;
    }

    const value = String(answer).trim();

    if (!value) return -1;

    const letterMatch = value.match(/^([A-D])$/i);

    if (letterMatch) {
      const index = letterMatch[1].toUpperCase().charCodeAt(0) - 65;

      return index < options.length ? index : -1;
    }

    const normalizedValue = normalizeAnswer(value);

    return options.findIndex(
      (option) =>
        normalizeAnswer(getOptionText(option)) === normalizedValue
    );
  };

  const getAnswerText = (answer, options = []) => {
    const index = getAnswerIndex(answer, options);

    if (index >= 0) {
      return getOptionText(options[index]);
    }

    if (answer === null || answer === undefined || answer === "") {
      return "Not answered";
    }

    if (typeof answer === "object") {
      return getOptionText(answer) || "Not available";
    }

    return String(answer);
  };

  const getCorrectAnswerIndex = (question) => {
    const correctAnswer =
      question.correctAnswer ??
      question.correctAnswerIndex ??
      question.answerIndex ??
      question.correctOption ??
      question.answer;

    return getAnswerIndex(
      correctAnswer,
      Array.isArray(question.options) ? question.options : []
    );
  };

  // =========================================
  // STATISTICS
  // =========================================

  const totalQuestions = quizzes.reduce(
    (total, quiz) =>
      total +
      (Number(quiz.questionCount) ||
        quiz.questions?.length ||
        0),
    0
  );

  const totalFlashcards = flashcards.reduce(
    (total, item) =>
      total +
      (Number(item.cardCount) ||
        item.cards?.length ||
        0),
    0
  );

  const totalInterviewQuestions = interviews.reduce(
    (total, item) =>
      total + (Number(item.completedQuestions) || 0),
    0
  );

  const totalSavedItems =
    notes.length +
    quizzes.length +
    flashcards.length +
    interviews.length;

  const anyLoading =
    notesLoading ||
    quizzesLoading ||
    flashcardsLoading ||
    interviewsLoading;

  const anyError =
    Boolean(notesError) ||
    Boolean(quizzesError) ||
    Boolean(flashcardsError) ||
    Boolean(interviewsError);

  // =========================================
  // FILTERS
  // =========================================

  const filters = [
    { id: "all", label: "All Items", count: totalSavedItems },
    { id: "notes", label: "Notes", count: notes.length },
    { id: "quizzes", label: "Quizzes", count: quizzes.length },
    { id: "flashcards", label: "Flashcards", count: flashcards.length },
    {
      id: "interviews",
      label: "Interview Practice",
      count: interviews.length
    }
  ];

  const showSection = (section) =>
    activeFilter === "all" || activeFilter === section;

  // =========================================
  // EMPTY / ERROR / LOADING STATE
  // =========================================

  const renderEmptyState = (
    Icon,
    title,
    message,
    type,
    onRetry = null
  ) => (
    <div className="learning-empty-state">
      <div className={`learning-empty-icon ${type}`}>
        <Icon size={27} />
      </div>

      <h3>{title}</h3>

      <p>{message}</p>

      {onRetry && (
        <button
          type="button"
          className="learning-retry-btn"
          onClick={onRetry}
        >
          <RefreshCw size={15} />
          Try Again
        </button>
      )}
    </div>
  );

  // =========================================
  // RENDER
  // =========================================

  return (
    <div className="my-learning-page">

      {/* =====================================
          PAGE HEADER
      ====================================== */}

      <section className="my-learning-hero">
        <div className="my-learning-hero-content">

          <div className="my-learning-eyebrow">
            <Sparkles size={14} />
            YOUR PERSONAL LEARNING SPACE
          </div>

          <h1>My Learning</h1>

          <p>
            Everything you've created, practised, and saved — all in one place.
          </p>

          <div className="my-learning-hero-summary">
            <span className="hero-summary-dot" />
            {totalSavedItems} saved learning items
          </div>

        </div>

        <div className="my-learning-hero-art">
          <div className="hero-art-circle hero-art-circle-one" />
          <div className="hero-art-circle hero-art-circle-two" />

          <div className="hero-art-icon">
            <GraduationCap size={48} />
          </div>

          <div className="hero-art-sparkle">
            <Sparkles size={19} />
          </div>
        </div>
      </section>

      {/* =====================================
          STATISTICS
      ====================================== */}

      <section className="learning-stats">

        <div className="learning-stat-card stat-notes">
          <div className="learning-stat-top">
            <div className="learning-stat-icon">
              <FileText size={21} />
            </div>
            <span className="learning-stat-label">LIBRARY</span>
          </div>

          <h3>{notes.length}</h3>
          <p>Saved Notes</p>
        </div>

        <div className="learning-stat-card stat-quizzes">
          <div className="learning-stat-top">
            <div className="learning-stat-icon">
              <ClipboardList size={21} />
            </div>
            <span className="learning-stat-label">PRACTICE</span>
          </div>

          <h3>{quizzes.length}</h3>
          <p>Completed Quizzes</p>
        </div>

        <div className="learning-stat-card stat-flashcards">
          <div className="learning-stat-top">
            <div className="learning-stat-icon">
              <Layers size={21} />
            </div>
            <span className="learning-stat-label">REVISION</span>
          </div>

          <h3>{flashcards.length}</h3>
          <p>Flashcard Sets</p>
        </div>

        <div className="learning-stat-card stat-questions">
          <div className="learning-stat-top">
            <div className="learning-stat-icon">
              <Trophy size={21} />
            </div>
            <span className="learning-stat-label">ASSESSMENT</span>
          </div>

          <h3>{totalQuestions}</h3>
          <p>Quiz Questions</p>
        </div>

        <div className="learning-stat-card stat-interviews">
          <div className="learning-stat-top">
            <div className="learning-stat-icon">
              <Brain size={21} />
            </div>
            <span className="learning-stat-label">CAREER</span>
          </div>

          <h3>{interviews.length}</h3>
          <p>Interview Sessions</p>
        </div>

      </section>

      {/* =====================================
          LEARNING LIBRARY AND FILTERS
      ====================================== */}

      <section className="learning-library">

        <div className="learning-library-heading">
          <div>
            <span className="learning-section-kicker">
              YOUR COLLECTION
            </span>

            <h2>Learning Library</h2>

            <p>
              Browse and manage your saved learning materials.
            </p>
          </div>

          <div className="learning-library-total">
            <BookOpen size={17} />
            {totalSavedItems} items
          </div>
        </div>

        <div className="learning-filter-bar">

          <div className="learning-filter-label">
            <Filter size={15} />
            <span>FILTER BY</span>
          </div>

          <div className="learning-filter-list">
            {filters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={`learning-filter-btn ${
                  activeFilter === filter.id ? "active" : ""
                }`}
                onClick={() => setActiveFilter(filter.id)}
                aria-pressed={activeFilter === filter.id}
              >
                {filter.label}
                <span>{filter.count}</span>
              </button>
            ))}
          </div>

        </div>
      </section>

      {/* =====================================
          NOTES
      ====================================== */}

      {showSection("notes") && (
        <section className="my-learning-section">

          <div className="my-learning-section-heading">
            <div className="section-title-group">

              <div className="section-title-icon notes-title-icon">
                <BookOpen size={20} />
              </div>

              <div>
                <h2>My Notes</h2>
                <p>Your saved study materials</p>
              </div>

            </div>

            <span className="section-count">
              {notes.length} items
            </span>
          </div>

          {notesLoading ? (
            renderEmptyState(
              BookOpen,
              "Loading your notes...",
              "Fetching your saved notes from the cloud.",
              "notes"
            )
          ) : notesError ? (
            renderEmptyState(
              BookOpen,
              "Unable to load notes",
              notesError,
              "notes",
              loadNotes
            )
          ) : notes.length === 0 ? (
            renderEmptyState(
              BookOpen,
              "No saved notes yet",
              "Generate notes using Notes Generator. Your saved notes will appear here.",
              "notes"
            )
          ) : (
            <div className="saved-notes-list">

              {notes.map((note) => (
                <article className="saved-note-card" key={note.id}>

                  <div className="saved-note-header">

                    <div className="saved-note-info">

                      <div className="saved-note-icon notes-title-icon">
                        <FileText size={21} />
                      </div>

                      <div className="saved-note-main">
                        <h3>{note.topic || "Untitled Notes"}</h3>

                        <div className="saved-note-meta">
                          {note.format && <span>{note.format}</span>}
                          {note.level && <span>{note.level}</span>}

                          <span>
                            <Calendar size={13} />
                            {formatDate(note.createdAt)}
                          </span>
                        </div>
                      </div>

                    </div>

                    <div className="saved-note-actions">

                      <button
                        type="button"
                        className="view-note-btn"
                        onClick={() =>
                          toggleItem(note.id, expandedNote, setExpandedNote)
                        }
                        aria-expanded={expandedNote === note.id}
                      >
                        {expandedNote === note.id ? "Hide" : "View"}

                        {expandedNote === note.id ? (
                          <ChevronUp size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )}
                      </button>

                      <button
                        type="button"
                        className="delete-note-btn"
                        onClick={() =>
                          openDeleteModal(
                            "note",
                            note.id,
                            note.topic || "Untitled Notes"
                          )
                        }
                        title="Delete notes"
                        aria-label="Delete notes"
                      >
                        <Trash2 size={17} />
                      </button>

                    </div>
                  </div>

                  {expandedNote === note.id && (
                    <div className="saved-note-content markdown-content">
                      {note.content ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {note.content}
                        </ReactMarkdown>
                      ) : (
                        <p className="detail-unavailable">
                          Note content is not available.
                        </p>
                      )}
                    </div>
                  )}

                </article>
              ))}

            </div>
          )}

        </section>
      )}

      {/* =====================================
          QUIZZES
      ====================================== */}

      {showSection("quizzes") && (
        <section className="my-learning-section">

          <div className="my-learning-section-heading">

            <div className="section-title-group">

              <div className="section-title-icon quizzes-title-icon">
                <ClipboardList size={20} />
              </div>

              <div>
                <h2>My Quizzes</h2>
                <p>Your completed assessments and results</p>
              </div>

            </div>

            <span className="section-count">
              {quizzes.length} completed
            </span>

          </div>

          {quizzesLoading ? (
            renderEmptyState(
              ClipboardList,
              "Loading your quizzes...",
              "Fetching your completed quizzes from the cloud.",
              "quizzes"
            )
          ) : quizzesError ? (
            renderEmptyState(
              ClipboardList,
              "Unable to load quizzes",
              quizzesError,
              "quizzes",
              loadQuizzes
            )
          ) : quizzes.length === 0 ? (
            renderEmptyState(
              ClipboardList,
              "No completed quizzes yet",
              "Complete a quiz using Quiz Generator. Your quiz history will appear here.",
              "quizzes"
            )
          ) : (
            <div className="saved-notes-list">

              {quizzes.map((quiz) => (
                <article className="saved-note-card" key={quiz.id}>

                  <div className="saved-note-header">

                    <div className="saved-note-info">

                      <div className="saved-note-icon quizzes-title-icon">
                        <ClipboardList size={21} />
                      </div>

                      <div className="saved-note-main">

                        <h3>{quiz.topic || "Untitled Quiz"}</h3>

                        <div className="saved-note-meta">
                          {quiz.difficulty && <span>{quiz.difficulty}</span>}
                          {quiz.questionType && <span>{quiz.questionType}</span>}

                          <span>
                            <Calendar size={13} />
                            {formatDate(quiz.createdAt)}
                          </span>
                        </div>

                        <div className="saved-note-meta quiz-result-meta">
                          <span>
                            {quiz.questionCount ?? quiz.questions?.length ?? 0} Questions
                          </span>

                          <span className="meta-correct">
                            <CheckCircle size={13} />
                            {quiz.correctAnswers ?? 0} Correct
                          </span>

                          <span className="meta-wrong">
                            <XCircle size={13} />
                            {quiz.wrongAnswers ?? 0} Wrong
                          </span>

                          <span className="meta-score">
                            <Trophy size={13} />
                            {quiz.percentage ?? 0}% Score
                          </span>
                        </div>

                      </div>
                    </div>

                    <div className="saved-note-actions">

                      <button
                        type="button"
                        className="view-note-btn"
                        onClick={() =>
                          toggleItem(quiz.id, expandedQuiz, setExpandedQuiz)
                        }
                        aria-expanded={expandedQuiz === quiz.id}
                      >
                        {expandedQuiz === quiz.id ? "Hide" : "View"}

                        {expandedQuiz === quiz.id ? (
                          <ChevronUp size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )}
                      </button>

                      <button
                        type="button"
                        className="delete-note-btn"
                        onClick={() =>
                          openDeleteModal(
                            "quiz",
                            quiz.id,
                            quiz.topic || "Untitled Quiz"
                          )
                        }
                        title="Delete quiz"
                        aria-label="Delete quiz"
                      >
                        <Trash2 size={17} />
                      </button>

                    </div>
                  </div>

                  {expandedQuiz === quiz.id && (
                    <div className="saved-note-content">

                      <div className="expanded-content-heading">
                        <h3>Quiz Results</h3>
                        <span>{quiz.percentage ?? 0}% score</span>
                      </div>

                      <div className="quiz-detail-summary">
                        <div>
                          <span>Topic</span>
                          <strong>{quiz.topic || "Not available"}</strong>
                        </div>

                        <div>
                          <span>Correct</span>
                          <strong>{quiz.correctAnswers ?? 0}</strong>
                        </div>

                        <div>
                          <span>Wrong</span>
                          <strong>{quiz.wrongAnswers ?? 0}</strong>
                        </div>

                        <div>
                          <span>Percentage</span>
                          <strong>{quiz.percentage ?? 0}%</strong>
                        </div>
                      </div>

                      <div className="expanded-divider" />

                      {Array.isArray(quiz.questions) && quiz.questions.length > 0 ? (
                        quiz.questions.map((question, index) => {
                          const options = Array.isArray(question.options)
                            ? question.options
                            : [];

                          const selectedIndex = getAnswerIndex(
                            question.userAnswer,
                            options
                          );

                          const correctIndex =
                            getCorrectAnswerIndex(question);

                          return (
                            <div className="quiz-question-detail" key={index}>

                              <h4>
                                {index + 1}. {question.question || "Question unavailable"}
                              </h4>

                              {options.length > 0 ? (
                                <div className="quiz-options-list">

                                  {options.map((option, optionIndex) => {
                                    const optionText = getOptionText(option);

                                    const isSelected =
                                      selectedIndex === optionIndex;

                                    const isCorrect =
                                      correctIndex === optionIndex;

                                    return (
                                      <div
                                        className={`quiz-option-detail ${
                                          isCorrect ? "option-correct" : ""
                                        } ${
                                          isSelected && !isCorrect
                                            ? "option-incorrect"
                                            : ""
                                        }`}
                                        key={optionIndex}
                                      >

                                        <span className="quiz-option-letter">
                                          {String.fromCharCode(65 + optionIndex)}
                                        </span>

                                        <span className="quiz-option-text">
                                          {optionText}
                                        </span>

                                        {isCorrect && (
                                          <span className="answer-indicator correct-indicator">
                                            <CheckCircle size={14} />
                                            {isSelected ? "Your Answer" : "Correct"}
                                          </span>
                                        )}

                                        {isSelected && !isCorrect && (
                                          <span className="answer-indicator incorrect-indicator">
                                            <XCircle size={14} />
                                            Your Answer
                                          </span>
                                        )}

                                      </div>
                                    );
                                  })}

                                </div>
                              ) : (
                                <p className="detail-unavailable">
                                  Options are not available.
                                </p>
                              )}

                              {question.userAnswer !== undefined && (
                                <p className="quiz-selected-answer">
                                  <strong>Your answer:</strong>{" "}
                                  {getAnswerText(question.userAnswer, options)}
                                </p>
                              )}

                              {correctIndex === -1 && (
                                <p className="detail-unavailable">
                                  Correct answer information is not available.
                                </p>
                              )}

                              {question.explanation && (
                                <div className="quiz-explanation">
                                  <strong>Explanation</strong>
                                  <p>{question.explanation}</p>
                                </div>
                              )}

                            </div>
                          );
                        })
                      ) : (
                        <p className="detail-unavailable">
                          Detailed question information is not available.
                        </p>
                      )}

                    </div>
                  )}

                </article>
              ))}

            </div>
          )}

        </section>
      )}

      {/* =====================================
          FLASHCARDS
      ====================================== */}

      {showSection("flashcards") && (
        <section className="my-learning-section">

          <div className="my-learning-section-heading">

            <div className="section-title-group">

              <div className="section-title-icon flashcards-title-icon">
                <Layers size={20} />
              </div>

              <div>
                <h2>My Flashcards</h2>
                <p>Your saved revision decks</p>
              </div>

            </div>

            <span className="section-count">
              {flashcards.length} sets
            </span>

          </div>

          {flashcardsLoading ? (
            renderEmptyState(
              Layers,
              "Loading your flashcards...",
              "Fetching your saved flashcard sets from the cloud.",
              "flashcards"
            )
          ) : flashcardsError ? (
            renderEmptyState(
              Layers,
              "Unable to load flashcards",
              flashcardsError,
              "flashcards",
              loadFlashcards
            )
          ) : flashcards.length === 0 ? (
            renderEmptyState(
              Layers,
              "No saved flashcards yet",
              "Generate flashcards using Flashcards. Your saved flashcard sets will appear here.",
              "flashcards"
            )
          ) : (
            <div className="saved-notes-list">

              {flashcards.map((item) => {
                const savedCards = Array.isArray(item.cards)
                  ? item.cards
                  : [];

                return (
                  <article className="saved-note-card" key={item.id}>

                    <div className="saved-note-header">

                      <div className="saved-note-info">

                        <div className="saved-note-icon flashcards-title-icon">
                          <Layers size={21} />
                        </div>

                        <div className="saved-note-main">

                          <h3>{item.topic || "Untitled Flashcards"}</h3>

                          <div className="saved-note-meta">
                            {item.difficulty && (
                              <span>{item.difficulty} Level</span>
                            )}

                            <span>
                              <BookOpen size={13} />
                              {savedCards.length} Flashcards
                            </span>

                            <span>
                              <Calendar size={13} />
                              {formatDate(item.createdAt)}
                            </span>
                          </div>

                        </div>
                      </div>

                      <div className="saved-note-actions">

                        <button
                          type="button"
                          className="view-note-btn"
                          onClick={() =>
                            toggleItem(
                              item.id,
                              expandedFlashcard,
                              setExpandedFlashcard
                            )
                          }
                          aria-expanded={expandedFlashcard === item.id}
                        >
                          {expandedFlashcard === item.id ? "Hide" : "View"}

                          {expandedFlashcard === item.id ? (
                            <ChevronUp size={16} />
                          ) : (
                            <ChevronDown size={16} />
                          )}
                        </button>

                        <button
                          type="button"
                          className="delete-note-btn"
                          onClick={() =>
                            openDeleteModal(
                              "flashcard",
                              item.id,
                              item.topic || "Untitled Flashcards"
                            )
                          }
                          title="Delete flashcards"
                          aria-label="Delete flashcards"
                        >
                          <Trash2 size={17} />
                        </button>

                      </div>
                    </div>

                    {expandedFlashcard === item.id && (
                      <div className="saved-note-content">

                        <div className="expanded-content-heading">
                          <h3>Flashcard Details</h3>
                          <span>{savedCards.length} cards</span>
                        </div>

                        <div className="detail-info-grid">
                          <div>
                            <span>Topic</span>
                            <strong>{item.topic || "Not available"}</strong>
                          </div>

                          <div>
                            <span>Difficulty</span>
                            <strong>{item.difficulty || "Not available"}</strong>
                          </div>

                          <div>
                            <span>Total Flashcards</span>
                            <strong>{savedCards.length}</strong>
                          </div>
                        </div>

                        <div className="expanded-divider" />

                        {savedCards.length > 0 ? (
                          <div className="flashcard-detail-grid">

                            {savedCards.map((card, index) => (
                              <div
                                className="flashcard-detail-item"
                                key={card.id ?? index}
                              >
                                <span className="flashcard-number">
                                  CARD {index + 1}
                                </span>

                                <h4>
                                  {card.question || "Question unavailable"}
                                </h4>

                                <div className="flashcard-answer">
                                  <span>ANSWER</span>
                                  <p>
                                    {card.answer || "Answer unavailable"}
                                  </p>
                                </div>
                              </div>
                            ))}

                          </div>
                        ) : (
                          <p className="detail-unavailable">
                            Flashcard details are not available.
                          </p>
                        )}

                      </div>
                    )}

                  </article>
                );
              })}

            </div>
          )}

        </section>
      )}

      {/* =====================================
          INTERVIEW PRACTICE
      ====================================== */}

      {showSection("interviews") && (
        <section className="my-learning-section">

          <div className="my-learning-section-heading">

            <div className="section-title-group">

              <div className="section-title-icon interviews-title-icon">
                <Brain size={20} />
              </div>

              <div>
                <h2>My Interview Practice</h2>
                <p>Your interview preparation history</p>
              </div>

            </div>

            <span className="section-count">
              {interviews.length} sessions
            </span>

          </div>

          {interviewsLoading ? (
            renderEmptyState(
              Brain,
              "Loading your interviews...",
              "Fetching your interview sessions from the cloud.",
              "interviews"
            )
          ) : interviewsError ? (
            renderEmptyState(
              Brain,
              "Unable to load interviews",
              interviewsError,
              "interviews",
              loadInterviews
            )
          ) : interviews.length === 0 ? (
            renderEmptyState(
              Brain,
              "No completed interview sessions yet",
              "Complete all questions in Interview Preparation. Your saved practice sessions will appear here.",
              "interviews"
            )
          ) : (
            <div className="saved-notes-list">

              {interviews.map((interview) => {
                const interviewQuestions = Array.isArray(interview.questions)
                  ? interview.questions
                  : [];

                return (
                  <article className="saved-note-card" key={interview.id}>

                    <div className="saved-note-header">

                      <div className="saved-note-info">

                        <div className="saved-note-icon interviews-title-icon">
                          <Brain size={21} />
                        </div>

                        <div className="saved-note-main">

                          <h3>
                            {interview.domain || "General"} Interview Practice
                          </h3>

                          <div className="saved-note-meta">
                            {interview.difficulty && (
                              <span>{interview.difficulty} Level</span>
                            )}

                            <span>
                              <Code size={13} />
                              {interview.totalQuestions ?? interviewQuestions.length} Questions
                            </span>

                            <span>
                              <CheckCircle size={13} />
                              {interview.completedQuestions ?? 0} Completed
                            </span>

                            <span>
                              <Calendar size={13} />
                              {formatDate(interview.createdAt)}
                            </span>
                          </div>

                        </div>
                      </div>

                      <div className="saved-note-actions">

                        <button
                          type="button"
                          className="view-note-btn"
                          onClick={() =>
                            toggleItem(
                              interview.id,
                              expandedInterview,
                              setExpandedInterview
                            )
                          }
                          aria-expanded={expandedInterview === interview.id}
                        >
                          {expandedInterview === interview.id ? "Hide" : "View"}

                          {expandedInterview === interview.id ? (
                            <ChevronUp size={16} />
                          ) : (
                            <ChevronDown size={16} />
                          )}
                        </button>

                        <button
                          type="button"
                          className="delete-note-btn"
                          onClick={() =>
                            openDeleteModal(
                              "interview",
                              interview.id,
                              `${interview.domain || "General"} Interview Practice`
                            )
                          }
                          title="Delete interview session"
                          aria-label="Delete interview session"
                        >
                          <Trash2 size={17} />
                        </button>

                      </div>
                    </div>

                    {expandedInterview === interview.id && (
                      <div className="saved-note-content">

                        <div className="expanded-content-heading">
                          <h3>Interview Practice Details</h3>
                          <span>
                            {interview.completedQuestions ?? 0} completed
                          </span>
                        </div>

                        <div className="detail-info-grid">

                          <div>
                            <span>Domain</span>
                            <strong>{interview.domain || "Not available"}</strong>
                          </div>

                          <div>
                            <span>Difficulty</span>
                            <strong>{interview.difficulty || "Not available"}</strong>
                          </div>

                          <div>
                            <span>Total Questions</span>
                            <strong>
                              {interview.totalQuestions ?? interviewQuestions.length}
                            </strong>
                          </div>

                          <div>
                            <span>Completed</span>
                            <strong>{interview.completedQuestions ?? 0}</strong>
                          </div>

                        </div>

                        <div className="expanded-divider" />

                        {interviewQuestions.length > 0 ? (
                          <div className="interview-question-list">

                            {interviewQuestions.map((item, index) => (
                              <div
                                className="interview-question-detail"
                                key={index}
                              >
                                <h4>
                                  {index + 1}. {item.question || "Question unavailable"}
                                </h4>

                                <div className="interview-answer">
                                  <span>GENERATED ANSWER</span>
                                  <p>
                                    {item.answer || "Answer not available."}
                                  </p>
                                </div>
                              </div>
                            ))}

                          </div>
                        ) : (
                          <p className="detail-unavailable">
                            Interview question details are not available.
                          </p>
                        )}

                      </div>
                    )}

                  </article>
                );
              })}

            </div>
          )}

        </section>
      )}

      {/* =====================================
          OVERALL EMPTY STATE
      ====================================== */}

      {!anyLoading &&
        !anyError &&
        totalSavedItems === 0 &&
        activeFilter === "all" && (
          <div className="learning-first-use">

            <div className="learning-first-use-icon">
              <GraduationCap size={34} />
            </div>

            <h3>Your learning library is ready</h3>

            <p>
              Start creating notes, taking quizzes, building flashcards, and
              practising interview questions. Your saved work will appear here.
            </p>

          </div>
        )}

      {/* =====================================
          FOOTER
      ====================================== */}

      <div className="learning-footer-note">
        <Sparkles size={15} />
        <span>
          Keep learning. Every saved step brings you closer to your goals.
        </span>
      </div>

      {/* =====================================
          DELETE CONFIRMATION MODAL
      ====================================== */}

      {deleteModal.isOpen && (
        <div
          className="delete-modal-overlay"
          onClick={closeDeleteModal}
        >
          <div
            className="delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            onClick={(event) => event.stopPropagation()}
          >

            <button
              className="delete-modal-close"
              type="button"
              onClick={closeDeleteModal}
              disabled={deleteModal.deleting}
              aria-label="Close confirmation"
            >
              <X size={19} />
            </button>

            <div className="delete-modal-icon">
              <Trash2 size={25} />
            </div>

            <h3 id="delete-modal-title">
              Delete Confirmation
            </h3>

            <p>
              Are you sure you want to delete
              <strong> {deleteModal.title}</strong>?
              This action cannot be undone.
            </p>

            {deleteError && (
              <p className="delete-modal-error" role="alert">
                {deleteError}
              </p>
            )}

            <div className="delete-modal-actions">

              <button
                className="delete-cancel-btn"
                type="button"
                onClick={closeDeleteModal}
                disabled={deleteModal.deleting}
              >
                Cancel
              </button>

              <button
                className="delete-confirm-btn"
                type="button"
                onClick={confirmDelete}
                disabled={deleteModal.deleting}
              >
                {deleteModal.deleting ? (
                  "Deleting..."
                ) : (
                  <>
                    <Trash2 size={16} />
                    Delete
                  </>
                )}
              </button>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export default MyLearning;