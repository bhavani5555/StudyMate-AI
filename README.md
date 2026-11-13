# StudyMate AI – AI-Powered Learning Platform

StudyMate AI is an AI-powered learning platform built to help students and aspiring software developers improve their technical skills, prepare for interviews, and manage their daily learning activities.

It brings AI-based learning tools, interview preparation, and study management features together in one application.

## Project Objectives

- Build a platform that makes technical learning easier.
- Help users understand programming concepts using AI.
- Generate study notes from topics and PDF documents.
- Create quizzes to test technical knowledge.
- Provide flashcards for quick revision.
- Help users prepare for technical interviews.
- Track learning progress and daily study time.
- Keep all learning tools in one place.

## Key Features

### 1. Dashboard
- View an overview of learning activities.
- Track study progress.
- Access all important features from one place.

### 2. AI Tutor
- Ask technical questions and get AI-generated answers.
- Understand programming concepts easily.
- Get help with different technical topics.

### 3. AI Notes Generator
- Generate study notes using AI.
- Upload PDF documents.
- View and download generated notes.

### 4. Quiz Generator
- Generate quizzes using AI.
- Practice technical questions.
- Check knowledge through quiz results.

### 5. Flashcards
- Create and manage flashcards.
- Revise important concepts.
- Improve memory through regular practice.

### 6. Interview Preparation
- Practice technical interview questions.
- Prepare for software developer interviews.
- Improve technical knowledge.

### 7. My Learning
- Manage learning activities.
- Organize study materials.
- Track learning progress.

### 8. Achievements
- View completed learning milestones.
- Track achievements.
- Stay motivated to continue learning.

### 9. Study Time Tracker
- Track daily study time.
- View time spent on learning.
- Maintain regular study habits.

### 10. Settings
- Manage application preferences.
- Customize available settings.
- Access account options.

## Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Web page structure |
| CSS3 | Styling and responsive design |
| JavaScript (ES6+) | Application functionality |
| React.js | Frontend development |
| Vite | Development server and build tool |
| Firebase Authentication | User authentication |
| Firebase Hosting | Application deployment |
| Google Gemini API | AI integration |
| Git | Version control |
| GitHub | Source code management |

## Repository Structure

The project contains the following main folders and files.

```text
StudyMate-AI/
├── public/
├── src/
│   ├── components/
│   ├── pages/
│   ├── assets/
│   ├── App.jsx
│   ├── App.css
│   └── main.jsx
├── Images/
├── .env
├── .gitignore
├── index.html
├── package.json
├── package-lock.json
└── README.md
```

*Note: Update this structure based on the actual files and folders in your project.*

## Requirements

- Node.js
- npm
- Git
- Firebase project configuration
- Google Gemini API key

## Installation and Setup

Follow these steps to run the project on your computer.

### Step 1 — Clone the Repository

```bash
git clone https://github.com/bhavani5555/StudyMate-AI.git
```

### Step 2 — Open the Project Folder

```bash
cd StudyMate-AI
```

### Step 3 — Install Dependencies

```bash
npm install
```

### Step 4 — Configure Environment Variables

Create a `.env` file in the main project folder.

Add your Gemini API key:

```env
VITE_GEMINI_API_KEY=your_gemini_api_key
```

Configure Firebase settings according to your Firebase project.

**Security Note:** Do not upload API keys or passwords to GitHub. Variables starting with `VITE_` are visible in browser code. For production, use a secure backend to handle Gemini API requests.

### Step 5 — Start the Application

```bash
npm run dev
```

Open the local URL displayed in the terminal to access the application.

### Step 6 — Build the Application

```bash
npm run build
```

This creates the production build inside the `dist/` folder.

## Project Screenshots

Screenshots of the application are available in the `Images` folder.

They show the main pages and features of StudyMate AI.

## Live Demo

[Visit StudyMate AI](https://studymate-ai-32855.web.app/)

## Project Highlights

- Developed an AI-powered learning platform using React.js.
- Integrated Google Gemini API for AI-based learning features.
- Used Firebase Authentication for user authentication.
- Deployed the application using Firebase Hosting.
- Built different tools for technical learning and interview preparation.
- Used Git and GitHub to manage project source code.

## Future Enhancements

- Add more AI-powered learning features.
- Improve learning progress tracking.
- Add personalized study recommendations.
- Improve interview preparation features.
- Add more options for revision and practice.

## Developer

Developed as a personal portfolio project to improve frontend development skills and gain practical experience with React.js, Firebase, and Generative AI.

**StudyMate AI – Learn Smarter. Prepare Better. Grow Faster.**