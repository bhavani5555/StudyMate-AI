
import { useState, useRef, useEffect, useCallback } from "react";

import {
  Sparkles,
  Upload,
  FileText,
  BookOpen,
  LoaderCircle,
  Download,
  Bookmark,
  Eye,
  Trash2,
  Search,
  RefreshCw,
  X,
} from "lucide-react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { jsPDF } from "jspdf";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import mammoth from "mammoth";

import { generateAIResponse } from "../services/aiService";

import {
  saveNoteToCloud,
  getCloudNotes,
  deleteCloudNote,
} from "../services/notesService";

import "./NotesGenerator.css";

// PDF WORKER

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// CONSTANTS

const MAX_DOCUMENT_CHARS = 45000;
const MAX_FILE_SIZE = 15 * 1024 * 1024;

// GENERAL HELPERS

const getSafeFilename = (value) =>
  (value || "StudyMate_Notes")
    .trim()
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "") || "StudyMate_Notes";

const getPlainText = (value = "") =>
  value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1 ($2)")
    .replace(/```[\w+-]*\n?/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*(.*?)\*\*/gs, "$1")
    .replace(/__(.*?)__/gs, "$1")
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1")
    .replace(/(?<!_)_([^_\n]+)_(?!_)/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/^\s*\d+[.)]\s+/gm, "• ")
    .replace(/\r/g, "")
    .trim();

const getSafePdfText = (value = "") =>
  value
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/•/g, "-")
    .replace(/\u00a0/g, " ");

// DOCUMENT EXTRACTION

const extractPdfText = async (file) => {
  const data = new Uint8Array(await file.arrayBuffer());

  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;

  const pageTexts = [];

  try {
    for (
      let pageNumber = 1;
      pageNumber <= pdf.numPages;
      pageNumber += 1
    ) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();

      const pageLines = [];
      let currentLine = "";
      let previousY = null;

      textContent.items.forEach((item) => {
        if (!item.str) return;

        const currentY = item.transform?.[5];

        if (
          previousY !== null &&
          currentY !== undefined &&
          Math.abs(previousY - currentY) > 3
        ) {
          if (currentLine.trim()) {
            pageLines.push(currentLine.trim());
          }

          currentLine = "";
        }

        currentLine += `${item.str} `;
        previousY = currentY;
      });

      if (currentLine.trim()) {
        pageLines.push(currentLine.trim());
      }

      pageTexts.push(pageLines.join("\n"));
    }
  } finally {
    await pdf.destroy();
  }

  return pageTexts.join("\n\n");
};

const extractDocumentText = async (file) => {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File size must be less than 15 MB.");
  }

  let extractedText = "";

  if (extension === "pdf") {
    extractedText = await extractPdfText(file);
  } else if (extension === "txt") {
    extractedText = await file.text();
  } else if (extension === "docx") {
    const arrayBuffer = await file.arrayBuffer();

    const result = await mammoth.extractRawText({
      arrayBuffer,
    });

    extractedText = result.value || "";
  } else {
    throw new Error(
      "Unsupported file format. Please upload PDF, TXT or DOCX."
    );
  }

  extractedText = extractedText
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!extractedText) {
    throw new Error(
      "No readable text was found. If this is a scanned PDF, OCR is required."
    );
  }

  return {
    text: extractedText.slice(0, MAX_DOCUMENT_CHARS),
    wasTruncated: extractedText.length > MAX_DOCUMENT_CHARS,
  };
};

// MARKDOWN PARSER FOR PDF

const parseNotes = (content = "") => {
  const lines = content.replace(/\r/g, "").split("\n");
  const blocks = [];

  let insideCode = false;
  let codeLines = [];
  let paragraphLines = [];
  let currentList = [];

  const flushParagraph = () => {
    if (paragraphLines.length) {
      blocks.push({
        type: "paragraph",
        text: getPlainText(paragraphLines.join(" ")),
      });

      paragraphLines = [];
    }
  };

  const flushList = () => {
    if (currentList.length) {
      blocks.push(...currentList);
      currentList = [];
    }
  };

  const flushCode = () => {
    if (codeLines.length) {
      blocks.push({
        type: "code",
        text: codeLines.join("\n"),
      });

      codeLines = [];
    }
  };

  lines.forEach((originalLine) => {
    const line = originalLine.trimEnd();
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      flushParagraph();
      flushList();

      if (insideCode) {
        flushCode();
        insideCode = false;
      } else {
        insideCode = true;
      }

      return;
    }

    if (insideCode) {
      codeLines.push(line);
      return;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);

    if (heading) {
      flushParagraph();
      flushList();

      blocks.push({
        type: heading[1].length === 1 ? "title" : "heading",
        text: getPlainText(heading[2]),
      });

      return;
    }

    if (/^([-*_])\1{2,}$/.test(trimmed)) {
      flushParagraph();
      flushList();
      return;
    }

    if (trimmed.startsWith("|")) {
      flushParagraph();
      flushList();

      if (/^\|?[\s:|-]+\|?$/.test(trimmed)) {
        return;
      }

      const cells = trimmed
        .split("|")
        .map((cell) => getPlainText(cell.trim()))
        .filter(Boolean);

      if (cells.length) {
        blocks.push({
          type: "table",
          text: cells.join("  |  "),
        });
      }

      return;
    }

    const bullet = trimmed.match(/^[-*+]\s+(.+)$/);

    if (bullet) {
      flushParagraph();

      currentList.push({
        type: "bullet",
        text: getPlainText(bullet[1]),
      });

      return;
    }

    const numbered = trimmed.match(/^(\d+)[.)]\s+(.+)$/);

    if (numbered) {
      flushParagraph();

      currentList.push({
        type: "number",
        number: numbered[1],
        text: getPlainText(numbered[2]),
      });

      return;
    }

    if (trimmed.startsWith(">")) {
      flushParagraph();
      flushList();

      blocks.push({
        type: "paragraph",
        text: getPlainText(trimmed),
      });

      return;
    }

    flushList();
    paragraphLines.push(trimmed);
  });

  flushParagraph();
  flushList();

  if (insideCode) {
    flushCode();
  }

  return blocks;
};

// SAVE PDF FILE

const saveDocument = async (blob, filename, mimeType) => {
  if (window.showSaveFilePicker) {
    try {
      const extension = filename.split(".").pop();

      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: "PDF Document",
            accept: {
              [mimeType]: [`.${extension}`],
            },
          },
        ],
      });

      const writable = await handle.createWritable();

      await writable.write(blob);
      await writable.close();

      return true;
    } catch (error) {
      if (error.name === "AbortError") {
        return false;
      }

      console.warn("Save picker unavailable:", error);
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 2000);

  return true;
};

// PDF GENERATOR

const createPDF = async (content, title) => {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const margin = 19;
  const usableWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - 18;

  let y = 22;

  const addPage = () => {
    pdf.addPage();
    y = 20;
  };

  const ensureSpace = (height) => {
    if (y + height > bottomLimit) {
      addPage();
    }
  };

  const writeWrappedText = (text, options = {}) => {
    const {
      fontSize = 10,
      font = "normal",
      color = [55, 55, 65],
      indent = 0,
      lineHeight = 5,
      after = 3,
    } = options;

    pdf.setFont("helvetica", font);
    pdf.setFontSize(fontSize);
    pdf.setTextColor(...color);

    const safeText = getSafePdfText(text);
    const lines = pdf.splitTextToSize(
      safeText,
      usableWidth - indent
    );

    lines.forEach((line) => {
      ensureSpace(lineHeight);

      pdf.text(line, margin + indent, y);
      y += lineHeight;
    });

    y += after;
  };

  writeWrappedText(title, {
    fontSize: 19,
    font: "bold",
    color: [45, 38, 67],
    lineHeight: 8,
    after: 2,
  });

  writeWrappedText(
    `Generated by StudyMate AI | ${new Date().toLocaleDateString("en-IN")}`,
    {
      fontSize: 8,
      color: [120, 120, 130],
      lineHeight: 4,
      after: 3,
    }
  );

  pdf.setDrawColor(220, 215, 230);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 8;

  const blocks = parseNotes(content);

  blocks.forEach((block) => {
    if (block.type === "title") {
      writeWrappedText(block.text, {
        fontSize: 15,
        font: "bold",
        color: [45, 38, 67],
        lineHeight: 7,
        after: 4,
      });

      return;
    }

    if (block.type === "heading") {
      writeWrappedText(block.text, {
        fontSize: 12,
        font: "bold",
        color: [105, 72, 170],
        lineHeight: 6,
        after: 3,
      });

      return;
    }

    if (block.type === "code") {
      const codeLines = block.text
        .split("\n")
        .flatMap((line) =>
          pdf.splitTextToSize(
            getSafePdfText(line || " "),
            usableWidth - 12
          )
        );

      let index = 0;

      while (index < codeLines.length) {
        const availableLines = Math.max(
          1,
          Math.floor((bottomLimit - y - 8) / 4.5)
        );

        const currentLines = codeLines.slice(
          index,
          index + availableLines
        );

        const boxHeight = currentLines.length * 4.5 + 7;

        ensureSpace(boxHeight);

        pdf.setFillColor(246, 246, 249);
        pdf.setDrawColor(228, 228, 235);

        pdf.roundedRect(
          margin,
          y - 4,
          usableWidth,
          boxHeight,
          2,
          2,
          "FD"
        );

        pdf.setFont("courier", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(45, 50, 60);

        pdf.text(currentLines, margin + 5, y + 1);

        y += boxHeight + 5;
        index += currentLines.length;
      }

      return;
    }

    if (block.type === "bullet") {
      writeWrappedText(`- ${block.text}`, {
        indent: 3,
        lineHeight: 5.2,
        after: 1,
      });

      return;
    }

    if (block.type === "number") {
      writeWrappedText(`${block.number}. ${block.text}`, {
        indent: 3,
        lineHeight: 5.2,
        after: 1,
      });

      return;
    }

    if (block.type === "table") {
      writeWrappedText(block.text, {
        fontSize: 9,
        color: [55, 55, 65],
        lineHeight: 5,
        after: 3,
      });

      return;
    }

    writeWrappedText(block.text, {
      fontSize: 10,
      lineHeight: 5.3,
      after: 3,
    });
  });

  const totalPages = pdf.internal.getNumberOfPages();

  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(145, 145, 155);

    pdf.text(
      `StudyMate AI  |  Page ${page} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 9,
      { align: "center" }
    );
  }

  return pdf.output("blob");
};

// NOTES GENERATOR COMPONENT

function NotesGenerator() {
  const [topic, setTopic] = useState("");
  const [format, setFormat] = useState("Detailed Notes");
  const [level, setLevel] = useState("Beginner");

  const [file, setFile] = useState(null);
  const [documentText, setDocumentText] = useState("");
  const [extractingFile, setExtractingFile] = useState(false);
  const [fileError, setFileError] = useState("");
  const [fileWarning, setFileWarning] = useState("");

  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  const [savedNotes, setSavedNotes] = useState([]);
  const [loadingSavedNotes, setLoadingSavedNotes] = useState(true);
  const [savedNotesError, setSavedNotesError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [deletingNoteId, setDeletingNoteId] = useState(null);

  const fileInputRef = useRef(null);

  // Prevent duplicate generation and overlapping operations.
  const operationLockRef = useRef(false);

  // Ignore results from an older file upload.
  const fileRequestIdRef = useRef(0);

  // LOAD SAVED NOTES

  const loadSavedNotes = useCallback(async () => {
    try {
      setLoadingSavedNotes(true);
      setSavedNotesError("");

      const cloudNotes = await getCloudNotes();

      setSavedNotes(
        Array.isArray(cloudNotes) ? cloudNotes : []
      );
    } catch (err) {
      console.error("Loading Saved Notes Error:", err);

      setSavedNotesError(
        "Unable to load saved notes. Please try again."
      );
    } finally {
      setLoadingSavedNotes(false);
    }
  }, []);

  useEffect(() => {
    loadSavedNotes();
  }, [loadSavedNotes]);

  // TOPIC INPUT

  const handleTopicChange = (event) => {
    setTopic(event.target.value);
    setNotes("");
    setError("");
    setSavedMessage("");
    setSelectedNoteId(null);
  };
  // FILE UPLOAD

  const handleFileChange = async (event) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) return;

    const requestId = ++fileRequestIdRef.current;

    setFile(selectedFile);
    setDocumentText("");
    setFileError("");
    setFileWarning("");
    setNotes("");
    setError("");
    setSavedMessage("");
    setSelectedNoteId(null);
    setExtractingFile(true);

    try {
      const result = await extractDocumentText(selectedFile);

      // Do not apply an outdated extraction result.
      if (requestId !== fileRequestIdRef.current) return;

      setDocumentText(result.text);

      if (result.wasTruncated) {
        setFileWarning(
          "This document is large. The first 45,000 characters were extracted for AI processing."
        );
      }
    } catch (err) {
      if (requestId !== fileRequestIdRef.current) return;

      console.error("Document Extraction Error:", err);

      setFile(null);
      setDocumentText("");

      setFileError(
        err.message || "Unable to read this document."
      );

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } finally {
      if (requestId === fileRequestIdRef.current) {
        setExtractingFile(false);
      }
    }
  };

  const handleRemoveFile = () => {
    // Invalidate any extraction still in progress.
    fileRequestIdRef.current += 1;

    setFile(null);
    setDocumentText("");
    setFileError("");
    setFileWarning("");
    setExtractingFile(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // GENERATION PROMPT

  const buildPrompt = (
    enteredTopic,
    currentFormat,
    currentLevel,
    currentDocumentText,
    currentFile
  ) => {
    const hasDocument = Boolean(currentDocumentText);

    if (hasDocument) {
      return `
You are an expert educational tutor and technical subject matter expert.

Your task is to prepare high-quality study notes using the uploaded document.

UPLOADED DOCUMENT:
${currentFile?.name || "Uploaded study material"}

USER INSTRUCTION OR TOPIC:
${enteredTopic || "Prepare notes covering the important topics in the uploaded document."}

NOTES FORMAT:
${currentFormat}

DIFFICULTY LEVEL:
${currentLevel}

DOCUMENT CONTENT:
"""
${currentDocumentText}
"""

STRICT CONTENT RULES:

1. Read and understand the supplied document carefully.
2. Base the notes on the uploaded document, not unrelated topics.
3. Do not invent facts, definitions, examples, or claims.
4. If the user specifies a topic, focus on that topic within the document.
5. If no topic is supplied, identify and organize the important topics.
6. Preserve important technical terms, definitions, formulas, examples, and facts.
7. Explain concepts in simple and understandable language.
8. If the document does not contain enough information for a requested topic, clearly say so.
9. Do not repeat the entire source document word for word.

FORMAT INSTRUCTIONS:

For Short Notes:
Create concise revision notes containing essential concepts and important points.

For Detailed Notes:
Explain important concepts thoroughly with examples and clear explanations.

For Exam Preparation Notes:
Organize content into definitions, key points, important questions, and exam-focused explanations.

For Interview Notes:
Focus on technical concepts, practical examples, commonly asked interview questions, and answers.

OUTPUT REQUIREMENTS:

- Use meaningful Markdown headings and subheadings.
- Use bullet points and numbered lists where appropriate.
- Use tables only when they improve clarity.
- Include code examples only when relevant.
- Keep the notes organized and easy to revise.
- Finish with a concise revision summary.

Generate the requested notes now.
`;
    }

    return `
You are an expert educational tutor and technical subject matter expert.

Generate high-quality study notes on the EXACT topic entered by the user.

USER'S TOPIC:
${enteredTopic}

NOTES FORMAT:
${currentFormat}

DIFFICULTY LEVEL:
${currentLevel}

INSTRUCTIONS:

1. Focus specifically on the exact topic entered by the user.
2. Do not unnecessarily expand into unrelated topics.
3. Start with a clear introduction.
4. Explain the topic step by step.
5. Include important definitions and terminology.
6. Explain all major concepts clearly.
7. Include practical examples wherever relevant.
8. Include complete and understandable code examples wherever relevant.
9. Explain code examples when useful.
10. Include real-world applications.
11. Highlight important points.
12. Include common mistakes and interview points where relevant.
13. Include interview questions and answers where relevant.
14. Adjust the explanation according to the selected difficulty level.
15. Use proper Markdown headings and subheadings.
16. Use numbered lists and bullet points wherever appropriate.
17. Avoid unnecessary repetition.
18. Do not provide incomplete explanations.
19. Finish with a short revision summary.

FORMAT REQUIREMENTS:

For Short Notes:
Provide concise explanations covering all essential points.

For Detailed Notes:
Provide comprehensive explanations, examples and practical details.

For Exam Preparation Notes:
Focus on definitions, key concepts, important points and exam-oriented explanations.

For Interview Notes:
Focus on technical explanations, practical examples and interview questions with answers.

Generate accurate, organized and complete study notes focused on the user's exact topic.
`;
  };

  // GENERATE AND SAVE NOTES

  const handleGenerate = async (event) => {
    event.preventDefault();

    const enteredTopic = topic.trim();

    if (!enteredTopic && !documentText) {
      setError(
        "Please enter a topic or upload a document before generating notes."
      );
      return;
    }

    if (extractingFile) {
      setError(
        "Please wait until document extraction is complete."
      );
      return;
    }

    if (operationLockRef.current) return;

    operationLockRef.current = true;

    // Capture the current values so the saved note matches
    // the settings used for this generation.
    const currentFormat = format;
    const currentLevel = level;
    const currentDocumentText = documentText;
    const currentFile = file;

    const noteTopic =
      enteredTopic ||
      currentFile?.name.replace(/\.[^/.]+$/, "") ||
      "Uploaded Document Notes";

    setLoading(true);
    setSavingNote(false);
    setError("");
    setNotes("");
    setSavedMessage("");
    setSelectedNoteId(null);

    try {
      const prompt = buildPrompt(
        enteredTopic,
        currentFormat,
        currentLevel,
        currentDocumentText,
        currentFile
      );

      const generatedContent = await generateAIResponse(prompt);

      if (
        typeof generatedContent !== "string" ||
        !generatedContent.trim()
      ) {
        throw new Error(
          "The AI returned an empty response. Please try again."
        );
      }

      const cleanContent = generatedContent.trim();

      // Display generated content immediately.
      setNotes(cleanContent);
      setLoading(false);
      setSavingNote(true);

      const newNote = {
        topic: noteTopic,
        format: currentFormat,
        level: currentLevel,
        content: cleanContent,
        sourceFileName: currentFile?.name || "",
        createdAt: new Date().toISOString(),
      };

      try {
        const savedNote = await saveNoteToCloud(newNote);

        if (savedNote?.id) {
          setSavedNotes((previousNotes) => [
            savedNote,
            ...previousNotes.filter(
              (note) => note.id !== savedNote.id
            ),
          ]);

          setSelectedNoteId(savedNote.id);
        } else {
          // If the service does not return the saved object,
          // refresh the cloud list to get its actual ID.
          await loadSavedNotes();
        }

        setSavedMessage(
          "Your notes have been saved to your cloud account!"
        );
      } catch (saveError) {
        console.error("Cloud Saving Error:", saveError);

        setError(
          "Notes generated successfully, but cloud saving failed. Your notes are still available here. You can download the PDF."
        );
      }
    } catch (err) {
      console.error("Notes Generation Failed:", err);

      setError(
        err.message || "Unable to generate notes. Please try again."
      );
    } finally {
      setLoading(false);
      setSavingNote(false);
      operationLockRef.current = false;
    }
  };

  // VIEW SAVED NOTE

  const handleViewNote = (note) => {
    if (!note) return;

    setNotes(note.content || "");
    setTopic(note.topic || "");
    setFormat(note.format || "Detailed Notes");
    setLevel(note.level || "Beginner");

    handleRemoveFile();

    setSelectedNoteId(note.id || null);
    setError("");
    setSavedMessage("Viewing your saved notes.");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // DELETE SAVED NOTE

  const handleDeleteNote = async (noteId) => {
    if (!noteId || deletingNoteId) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this saved note?"
    );

    if (!confirmed) return;

    try {
      setDeletingNoteId(noteId);

      await deleteCloudNote(noteId);

      setSavedNotes((previousNotes) =>
        previousNotes.filter((note) => note.id !== noteId)
      );

      if (selectedNoteId === noteId) {
        setNotes("");
        setSelectedNoteId(null);
        setSavedMessage("");
        setError("");
      }
    } catch (err) {
      console.error("Delete Note Error:", err);

      window.alert(
        "Unable to delete this note. Please try again."
      );
    } finally {
      setDeletingNoteId(null);
    }
  };
  // DOWNLOAD PDF

  const handleDownloadPDF = async (note) => {
    if (!note?.content || downloading) return;

    setDownloading(true);

    try {
      const topicName = note.topic || "StudyMate Notes";
      const safeTopic = getSafeFilename(topicName);
      const title = `${topicName} - Study Notes`;

      const pdfBlob = await createPDF(note.content, title);

      const saved = await saveDocument(
        pdfBlob,
        `${safeTopic}_Notes.pdf`,
        "application/pdf"
      );

      if (!saved) {
        return;
      }
    } catch (err) {
      console.error("PDF Download Error:", err);

      window.alert(
        "Unable to prepare your PDF. Please try again."
      );
    } finally {
      setDownloading(false);
    }
  };

  // SEARCH SAVED NOTES

  const filteredNotes = savedNotes.filter((note) =>
    `${note.topic || ""} ${note.format || ""} ${note.level || ""} ${note.sourceFileName || ""}`
      .toLowerCase()
      .includes(searchTerm.trim().toLowerCase())
  );
  // FORMAT DATE

  const formatDate = (dateValue) => {
    if (!dateValue) return "Date unavailable";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "Date unavailable";
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // UI

  return (
    <div className="notes-page">
      <div className="notes-header">
        <h1>Notes Generator</h1>
        <p>
          Generate clear, structured and easy-to-understand
          study notes with AI.
        </p>
      </div>

      <div className="notes-layout">
        {/* GENERATOR FORM */}

        <div className="notes-form-card">
          <h2>Create Your Notes</h2>

          <form onSubmit={handleGenerate}>
            <div className="notes-form-group">
              <label htmlFor="notes-topic">
                Enter Your Topic
                <span className="notes-optional-label">
                  {" "} (Optional if a document is uploaded)
                </span>
              </label>

              <input
                id="notes-topic"
                type="text"
                value={topic}
                onChange={handleTopicChange}
                placeholder="Example: Java HashMap Internal Working"
                maxLength={150}
                autoComplete="off"
                disabled={loading || savingNote}
              />

              <span className="notes-input-hint">
                Enter a topic, or leave it empty to create notes
                from your uploaded document.
              </span>
            </div>

            <div className="notes-form-group">
              <label>Upload Study Material (Optional)</label>

              <label
                className={`notes-upload-area ${
                  extractingFile ? "uploading" : ""
                }`}
              >
                {extractingFile ? (
                  <LoaderCircle
                    size={28}
                    className="spin"
                  />
                ) : (
                  <Upload size={28} />
                )}

                <p>
                  {extractingFile
                    ? "Reading your document..."
                    : file
                      ? file.name
                      : "Click to upload your study material"}
                </p>

                <span>PDF, TXT or DOCX · Maximum 15 MB</span>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.docx"
                  onChange={handleFileChange}
                  disabled={
                    extractingFile ||
                    loading ||
                    savingNote
                  }
                />
              </label>

              {file && !extractingFile && documentText && (
                <div className="notes-file-success">
                  <div>
                    <FileText size={17} />
                    <span>
                      Document read successfully
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    aria-label="Remove uploaded document"
                    disabled={loading || savingNote}
                  >
                    <X size={17} />
                  </button>
                </div>
              )}

              {extractingFile && (
                <p className="notes-file-status">
                  Extracting text from {file?.name}...
                </p>
              )}

              {fileError && (
                <p className="notes-error-message">
                  {fileError}
                </p>
              )}

              {fileWarning && (
                <p className="notes-file-warning">
                  {fileWarning}
                </p>
              )}
            </div>

            <div className="notes-form-group">
              <label htmlFor="notes-format">
                Notes Format
              </label>

              <select
                id="notes-format"
                value={format}
                onChange={(event) =>
                  setFormat(event.target.value)
                }
                disabled={loading || savingNote}
              >
                <option>Short Notes</option>
                <option>Detailed Notes</option>
                <option>Exam Preparation Notes</option>
                <option>Interview Notes</option>
              </select>
            </div>

            <div className="notes-form-group">
              <label htmlFor="notes-level">
                Difficulty Level
              </label>

              <select
                id="notes-level"
                value={level}
                onChange={(event) =>
                  setLevel(event.target.value)
                }
                disabled={loading || savingNote}
              >
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>
            </div>

            <button
              type="submit"
              className="generate-notes-btn"
              disabled={
                loading ||
                savingNote ||
                extractingFile
              }
            >
              {loading ? (
                <>
                  <LoaderCircle
                    size={19}
                    className="spin"
                  />
                  Generating Notes...
                </>
              ) : savingNote ? (
                <>
                  <LoaderCircle
                    size={19}
                    className="spin"
                  />
                  Saving to Cloud...
                </>
              ) : extractingFile ? (
                <>
                  <LoaderCircle
                    size={19}
                    className="spin"
                  />
                  Reading Document...
                </>
              ) : (
                <>
                  <Sparkles size={19} />
                  Generate Notes
                </>
              )}
            </button>
          </form>
        </div>

        {/* NOTES PREVIEW */}

        <div className="notes-preview-card">
          <div className="preview-heading">
            <h2>Notes Preview</h2>
            <FileText size={22} color="#8055e8" />
          </div>

          {loading ? (
            <div className="preview-empty">
              <LoaderCircle
                size={42}
                className="spin"
              />
              <h3>Generating your notes...</h3>
              <p>
                Please wait while StudyMate AI prepares your notes.
              </p>
            </div>
          ) : !notes ? (
            <div className="preview-empty">
              <BookOpen size={48} />
              <h3>Your notes will appear here</h3>
              <p>
                Enter a topic or upload a document to prepare
                your study notes.
              </p>

              {error && (
                <p className="notes-error-message">
                  {error}
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="notes-preview-actions">
                <div className="notes-preview-status">
                  {savedMessage && (
                    <span className="notes-cloud-success">
                      ✓ {savedMessage}
                    </span>
                  )}

                  {savingNote && (
                    <span className="notes-cloud-success">
                      <LoaderCircle
                        size={15}
                        className="spin"
                      />
                      Saving notes to your cloud account...
                    </span>
                  )}
                </div>

                <div className="notes-download-actions">
                  <button
                    type="button"
                    className="notes-download-btn"
                    onClick={() =>
                      handleDownloadPDF({
                        topic,
                        content: notes,
                      })
                    }
                    disabled={downloading}
                  >
                    {downloading ? (
                      <LoaderCircle
                        size={16}
                        className="spin"
                      />
                    ) : (
                      <Download size={16} />
                    )}
                    {downloading
                      ? "Preparing PDF..."
                      : "Download PDF"}
                  </button>
                </div>
              </div>

              {error && (
                <p className="notes-error-message">
                  {error}
                </p>
              )}

              <div className="generated-notes">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {notes}
                </ReactMarkdown>
              </div>
            </>
          )}
        </div>
      </div>

      {/* SAVED NOTES */}

      <div className="saved-notes-section">
        <div className="saved-notes-header">
          <div className="saved-notes-title">
            <div className="saved-notes-icon">
              <Bookmark size={21} />
            </div>

            <div>
              <h2>Saved Notes</h2>
              <p>
                Access and manage your previously generated notes.
              </p>
            </div>
          </div>

          <div className="saved-notes-count">
            {savedNotes.length}{" "}
            {savedNotes.length === 1 ? "Note" : "Notes"}
          </div>
        </div>

        <div className="saved-notes-search">
          <Search size={18} />

          <input
            type="text"
            placeholder="Search your saved notes..."
            value={searchTerm}
            onChange={(event) =>
              setSearchTerm(event.target.value)
            }
            aria-label="Search saved notes"
          />

          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              aria-label="Clear search"
            >
              <X size={17} />
            </button>
          )}
        </div>

        {loadingSavedNotes ? (
          <div className="saved-notes-empty">
            <LoaderCircle
              size={30}
              className="spin"
            />
            <p>Loading your saved notes...</p>
          </div>
        ) : savedNotesError ? (
          <div className="saved-notes-empty">
            <p>{savedNotesError}</p>

            <button
              type="button"
              className="saved-notes-retry-btn"
              onClick={loadSavedNotes}
            >
              <RefreshCw size={15} />
              Try Again
            </button>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="saved-notes-empty">
            <BookOpen size={38} />

            <h3>
              {searchTerm
                ? "No matching notes found"
                : "No saved notes yet"}
            </h3>

            <p>
              {searchTerm
                ? "Try searching with a different topic."
                : "Your generated notes will automatically appear here."}
            </p>
          </div>
        ) : (
          <div className="saved-notes-grid">
            {filteredNotes.map((note) => (
              <div
                className={`saved-note-card ${
                  selectedNoteId === note.id ? "active" : ""
                }`}
                key={note.id}
              >
                <div className="saved-note-card-top">
                  <div className="saved-note-file-icon">
                    <FileText size={22} />
                  </div>

                  <span className="saved-note-date">
                    {formatDate(note.createdAt)}
                  </span>
                </div>

                <div className="saved-note-info">
                  <h3>
                    {note.topic || "Untitled Notes"}
                  </h3>

                  <p>
                    {note.format || "Detailed Notes"} ·{" "}
                    {note.level || "Beginner"}
                  </p>

                  {note.sourceFileName && (
                    <span className="saved-note-source">
                      <FileText size={13} />
                      {note.sourceFileName}
                    </span>
                  )}
                </div>

                <div className="saved-note-actions">
                  <button
                    type="button"
                    className="saved-note-view-btn"
                    onClick={() => handleViewNote(note)}
                  >
                    <Eye size={15} />
                    View
                  </button>

                  <button
                    type="button"
                    className="saved-note-download-btn"
                    onClick={() => handleDownloadPDF(note)}
                    disabled={downloading}
                  >
                    <Download size={15} />
                    PDF
                  </button>

                  <button
                    type="button"
                    className="saved-note-delete-btn"
                    onClick={() => handleDeleteNote(note.id)}
                    disabled={
                      deletingNoteId === note.id ||
                      Boolean(deletingNoteId)
                    }
                    title="Delete note"
                    aria-label={`Delete ${note.topic || "saved note"}`}
                  >
                    {deletingNoteId === note.id ? (
                      <LoaderCircle
                        size={16}
                        className="spin"
                      />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default NotesGenerator;
