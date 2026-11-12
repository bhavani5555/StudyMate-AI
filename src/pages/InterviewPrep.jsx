
import { useState } from "react";

import {
  Brain,
  Code,
  ChevronDown,
  Eye,
  EyeOff,
  Trophy,
  RefreshCw,
  CheckCircle
} from "lucide-react";

import { generateAIResponse } from "../services/aiService";
import { saveInterviewToCloud } from "../services/interviewService";

import "./InterviewPrep.css";

// Available Interview Domains
// Interview Domains grouped by category
const domainGroups = {
  "Programming Languages": [
    "Java",
    "Python",
    "C",
    "C++",
    "C#",
    "JavaScript",
    "TypeScript"
  ],

  "Frontend Development": [
    "HTML",
    "CSS",
    "React",
    "Angular",
    "JavaScript ES6",
    "Bootstrap"
  ],

  "Backend Development": [
    "Core Java",
    "Spring Core",
    "Spring Boot",
    "Spring MVC",
    "Spring Security",
    "Spring Data JPA",
    "Hibernate",
    "JDBC",
    "REST APIs",
    "Microservices",
    "Node.js"
  ],

  "Databases": [
    "SQL",
    "MySQL",
    "PostgreSQL",
    "MongoDB",
    "Database Management System"
  ],

  "Computer Science": [
    "Data Structures and Algorithms",
    "Operating Systems",
    "Computer Networks",
    "Object Oriented Programming",
    "Software Engineering"
  ],

  "Development Tools": [
    "Git",
    "GitHub",
    "Maven",
    "Docker"
  ]
};

// Flatten all domains for statistics
const domains = Object.values(domainGroups).flat();

// Extract JSON from Gemini Response
function extractJSON(response) {
  const cleaned = response
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error("Gemini returned an invalid response.");
  }

  return JSON.parse(cleaned.substring(start, end + 1));
}

// Validate Generated Questions
function prepareQuestions(data, questionCount) {
  if (
    !Array.isArray(data?.questions) ||
    data.questions.length !== questionCount
  ) {
    throw new Error(
      `Gemini did not generate exactly ${questionCount} questions.`
    );
  }

  return data.questions.map((item) => {
    if (
      typeof item.question !== "string" ||
      !item.question.trim() ||
      typeof item.answer !== "string" ||
      !item.answer.trim()
    ) {
      throw new Error(
        "Some questions or answers are incomplete."
      );
    }

    return {
      question: item.question.trim(),
      answer: item.answer.trim()
    };
  });
}

function InterviewPrep() {
  const [domain, setDomain] = useState("Java");
  const [difficulty, setDifficulty] = useState("Easy");
  const [questionCount, setQuestionCount] = useState(15);

  const [questions, setQuestions] = useState([]);
  const [visibleAnswers, setVisibleAnswers] = useState([]);
  const [completed, setCompleted] = useState([]);

  const [generated, setGenerated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [sessionId, setSessionId] = useState(null);
  const [sessionSaved, setSessionSaved] = useState(false);

  // Generate Questions Using Gemini AI
  const generateQuestions = async () => {
    setLoading(true);
    setError("");
    setGenerated(false);

    setQuestions([]);
    setVisibleAnswers([]);
    setCompleted([]);

    setSessionId(null);
    setSessionSaved(false);

    const prompt = `
You are an experienced technical interviewer.

Generate exactly ${questionCount} technical interview questions and answers.

Selected Domain: ${domain}
Difficulty Level: ${difficulty}

Target Audience:
Freshers preparing for technical interviews.

Instructions:

1. Generate questions only from the selected domain: ${domain}.
2. Questions must be relevant to the selected domain.
3. Follow the selected difficulty level: ${difficulty}.
4. Easy questions should cover fundamental concepts.
5. Medium questions should cover practical concepts and implementation.
6. Hard questions should cover advanced concepts, problem-solving and real-world scenarios.
7. Answers must be technically accurate.
8. Answers should be clear and suitable for interview preparation.
9. Do not generate multiple-choice questions.
10. Avoid repeating questions.
11. Include meaningful answers for every question.
12. Do not generate questions from unrelated domains.
13. Keep answers concise but informative.

Return ONLY valid JSON in this exact format:

{
  "questions": [
    {
      "question": "Question text",
      "answer": "Detailed but concise answer"
    }
  ]
}

Important:
- Return exactly ${questionCount} questions.
- Return exactly ${questionCount} answers.
- Do not include Markdown.
- Do not include explanations outside the JSON.
`;

    try {
      let generatedQuestions = null;
      let lastError = null;

      // Retry once if Gemini returns invalid data
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await generateAIResponse(prompt);
          const data = extractJSON(response);

          generatedQuestions = prepareQuestions(
            data,
            questionCount
          );

          break;
        } catch (err) {
          lastError = err;
        }
      }

      if (!generatedQuestions) {
        throw (
          lastError ||
          new Error("Unable to generate interview questions.")
        );
      }

      setQuestions(generatedQuestions);
      setSessionId(Date.now());
      setGenerated(true);

    } catch (err) {
      console.error(
        "Interview question generation error:",
        err
      );

      setError(
        err.message ||
        "Unable to generate questions. Please try again."
      );

    } finally {
      setLoading(false);
    }
  };

  // Show or Hide Answer
  const toggleAnswer = (index) => {
    setVisibleAnswers((previous) =>
      previous.includes(index)
        ? previous.filter((item) => item !== index)
        : [...previous, index]
    );
  };

  // Save Completed Interview Session to Firebase
  const markCompleted = async (index) => {
    if (
      completed.includes(index) ||
      saving ||
      sessionSaved
    ) {
      return;
    }

    const updatedCompleted = [...completed, index];

    setCompleted(updatedCompleted);
    setError("");

    // Save only when all questions are completed
    if (updatedCompleted.length === questions.length) {
      setSaving(true);

      const newSession = {
        sessionId,
        domain,
        difficulty,
        totalQuestions: questions.length,
        completedQuestions: updatedCompleted.length,
        questions,
        createdAt: new Date().toISOString()
      };

      try {
        await saveInterviewToCloud(newSession);

        setSessionSaved(true);

      } catch (err) {
        console.error(
          "Interview session saving error:",
          err
        );

        setError(
          err.message ||
          "Practice completed, but saving failed. Please try again."
        );

        // Keep completed questions marked.
        // The user can retry saving below.
      } finally {
        setSaving(false);
      }
    }
  };

  // Retry Saving if Firebase Fails
  const retrySaveSession = async () => {
    if (
      saving ||
      sessionSaved ||
      completed.length !== questions.length
    ) {
      return;
    }

    setSaving(true);
    setError("");

    const newSession = {
      sessionId,
      domain,
      difficulty,
      totalQuestions: questions.length,
      completedQuestions: completed.length,
      questions,
      createdAt: new Date().toISOString()
    };

    try {
      await saveInterviewToCloud(newSession);
      setSessionSaved(true);
    } catch (err) {
      console.error("Interview retry save error:", err);

      setError(
        err.message ||
        "Unable to save your interview session. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  // Reset Interview Practice
  const resetPractice = () => {
    setQuestions([]);
    setVisibleAnswers([]);
    setCompleted([]);

    setGenerated(false);
    setError("");

    setSessionId(null);
    setSessionSaved(false);
    setSaving(false);
  };

  return (
    <div className="interview-page">

      {/* Header */}
      <div className="interview-header">
        <div>
          <h1>Interview Preparation</h1>

          <p>
            Prepare for technical interviews and improve
            your confidence.
          </p>
        </div>

        <div className="interview-header-icon">
          <Brain size={30} />
        </div>
      </div>

      {/* Statistics */}
      <div className="interview-stats">

        <div className="interview-stat-card">
          <div className="interview-stat-icon purple">
            <Code size={22} />
          </div>

          <div>
            <h3>{domains.length}</h3>
            <p>Domains Available</p>
          </div>
        </div>

        <div className="interview-stat-card">
          <div className="interview-stat-icon blue">
            <Brain size={22} />
          </div>

          <div>
            <h3>{questions.length}</h3>
            <p>Questions Generated</p>
          </div>
        </div>

        <div className="interview-stat-card">
          <div className="interview-stat-icon green">
            <Trophy size={22} />
          </div>

          <div>
            <h3>{completed.length}</h3>
            <p>Completed Questions</p>
          </div>
        </div>
      </div>

      {/* Configuration */}
      <div className="interview-config">
        <h2>Start Your Practice</h2>

        <p>
          Select your preferred interview settings.
        </p>

        <div className="interview-select-grid">

          {/* Domain Selection */}
          <div className="interview-field">
            <label>Select Domain</label>

            <div className="interview-select-wrapper">
            <select
  value={domain}
  onChange={(e) => setDomain(e.target.value)}
  disabled={loading || saving}
>
  {Object.entries(domainGroups).map(([category, topics]) => (
    <optgroup key={category} label={category}>
      {topics.map((item) => (
        <option key={item} value={item}>
          {item}
        </option>
      ))}
    </optgroup>
  ))}
</select>

              <ChevronDown size={18} />
            </div>
          </div>

          {/* Difficulty Selection */}
          <div className="interview-field">
            <label>Select Difficulty</label>

            <div className="interview-select-wrapper">
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                disabled={loading || saving}
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>

              <ChevronDown size={18} />
            </div>
          </div>

          {/* Question Count */}
          <div className="interview-field">
            <label>Select Number of Questions</label>

            <div className="interview-select-wrapper">
              <select
                value={questionCount}
                onChange={(e) =>
                  setQuestionCount(Number(e.target.value))
                }
                disabled={loading || saving}
              >
                <option value={5}>5 Questions</option>
                <option value={10}>10 Questions</option>
                <option value={15}>15 Questions</option>
                <option value={20}>20 Questions</option>
                <option value={25}>25 Questions</option>
              </select>

              <ChevronDown size={18} />
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <button
          className="generate-interview-btn"
          onClick={generateQuestions}
          disabled={loading || saving}
        >
          {loading ? (
            <RefreshCw
              size={19}
              className="interview-spin"
            />
          ) : (
            <Brain size={19} />
          )}

          {loading
            ? "Generating Questions..."
            : "Generate Questions"}
        </button>

        {/* Error Message */}
        {error && (
          <p className="interview-error-message">
            {error}
          </p>
        )}

      </div>

      {/* Loading State */}
      {loading && (
        <div className="interview-loading">
          <RefreshCw
            size={22}
            className="interview-spin"
          />

          <p>
            Gemini AI is preparing your interview questions...
          </p>
        </div>
      )}

      {/* Generated Questions */}
      {generated && (
        <div className="interview-questions-section">

          {/* Questions Header */}
          <div className="interview-questions-header">
            <div>
              <h2>{domain} Interview Questions</h2>

              <p>
                {difficulty} Level · {questions.length} Questions
              </p>
            </div>

            <button
              className="reset-interview-btn"
              onClick={resetPractice}
              disabled={saving}
            >
              <RefreshCw size={16} />
              Reset
            </button>
          </div>

          {/* Progress */}
          <div className="interview-progress">
            <div className="progress-info">
              <span>Practice Progress</span>

              <span>
                {completed.length}/{questions.length}
              </span>
            </div>

            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${
                    questions.length
                      ? (completed.length / questions.length) * 100
                      : 0
                  }%`
                }}
              />
            </div>
          </div>

          {/* Saving State */}
          {saving && (
            <div className="interview-completion-message">
              <RefreshCw
                size={20}
                className="interview-spin"
              />

              <p>
                Saving your interview session to Firebase...
              </p>
            </div>
          )}

          {/* Completion Message */}
          {sessionSaved && (
            <div className="interview-completion-message">
              <CheckCircle size={20} />

              <p>
                Congratulations! Your interview practice
                has been saved in My Learning.
              </p>
            </div>
          )}

          {/* Retry Save */}
          {!sessionSaved &&
            !saving &&
            completed.length === questions.length &&
            questions.length > 0 && (
              <button
                className="generate-interview-btn"
                onClick={retrySaveSession}
              >
                <RefreshCw size={18} />
                Retry Saving Session
              </button>
            )}

          {/* Question Cards */}
          {questions.map((item, index) => (
            <div
              className="interview-question-card"
              key={index}
            >
              <div className="question-card-top">
                <span className="question-number">
                  Question {index + 1}
                </span>

                <span className="question-difficulty">
                  {difficulty}
                </span>
              </div>

              <h3>{item.question}</h3>

              {/* Show / Hide Answer */}
              <button
                className="show-answer-btn"
                onClick={() => toggleAnswer(index)}
              >
                {visibleAnswers.includes(index) ? (
                  <>
                    <EyeOff size={17} />
                    Hide Answer
                  </>
                ) : (
                  <>
                    <Eye size={17} />
                    Show Answer
                  </>
                )}
              </button>

              {/* Answer Section */}
              {visibleAnswers.includes(index) && (
                <div className="interview-answer">
                  <strong>Answer:</strong>

                  <p>{item.answer}</p>

                  <button
                    className="mark-completed-btn"
                    onClick={() => markCompleted(index)}
                    disabled={
                      completed.includes(index) ||
                      saving ||
                      sessionSaved
                    }
                  >
                    <CheckCircle size={17} />

                    {completed.includes(index)
                      ? "Completed"
                      : "Mark as Completed"}
                  </button>
                </div>
              )}
            </div>
          ))}

        </div>
      )}

    </div>
  );
}

export default InterviewPrep;
