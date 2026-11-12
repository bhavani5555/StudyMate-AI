
import {
    collection,
    addDoc,
    getDocs,
    query,
    orderBy,
    deleteDoc,
    doc
  } from "firebase/firestore";
  
  import { auth, db } from "../firebase";
  
  // Save completed quiz to Firestore
  export const saveQuizToCloud = async (quiz) => {
    const user = auth.currentUser;
  
    if (!user) {
      throw new Error("Please login to save your quiz.");
    }
  
    const quizzesRef = collection(
      db,
      "users",
      user.uid,
      "quizzes"
    );
  
    const docRef = await addDoc(quizzesRef, quiz);
  
    return {
      ...quiz,
      id: docRef.id
    };
  };
  
  // Get all quizzes from Firestore
  export const getCloudQuizzes = async () => {
    const user = auth.currentUser;
  
    if (!user) {
      throw new Error("Please login to access your quizzes.");
    }
  
    const quizzesRef = collection(
      db,
      "users",
      user.uid,
      "quizzes"
    );
  
    const quizzesQuery = query(
      quizzesRef,
      orderBy("createdAt", "desc")
    );
  
    const snapshot = await getDocs(quizzesQuery);
  
    return snapshot.docs.map((document) => ({
      id: document.id,
      ...document.data()
    }));
  };
  
  // Delete a quiz from Firestore
  export const deleteCloudQuiz = async (quizId) => {
    const user = auth.currentUser;
  
    if (!user) {
      throw new Error("Please login to delete your quiz.");
    }
  
    const quizRef = doc(
      db,
      "users",
      user.uid,
      "quizzes",
      quizId
    );
  
    await deleteDoc(quizRef);
  };
  