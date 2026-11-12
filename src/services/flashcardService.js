
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
  
  // Save a flashcard deck to Firestore
  export const saveFlashcardToCloud = async (flashcardSet) => {
    const user = auth.currentUser;
  
    if (!user) {
      throw new Error("Please login to save your flashcards.");
    }
  
    const flashcardsRef = collection(
      db,
      "users",
      user.uid,
      "flashcards"
    );
  
    const docRef = await addDoc(flashcardsRef, flashcardSet);
  
    return {
      ...flashcardSet,
      id: docRef.id
    };
  };
  
  // Get all flashcard decks from Firestore
  export const getCloudFlashcards = async () => {
    const user = auth.currentUser;
  
    if (!user) {
      throw new Error("Please login to access your flashcards.");
    }
  
    const flashcardsRef = collection(
      db,
      "users",
      user.uid,
      "flashcards"
    );
  
    const flashcardsQuery = query(
      flashcardsRef,
      orderBy("createdAt", "desc")
    );
  
    const snapshot = await getDocs(flashcardsQuery);
  
    return snapshot.docs.map((document) => ({
      id: document.id,
      ...document.data()
    }));
  };
  
  // Delete a flashcard deck from Firestore
  export const deleteCloudFlashcard = async (flashcardId) => {
    const user = auth.currentUser;
  
    if (!user) {
      throw new Error("Please login to delete your flashcards.");
    }
  
    const flashcardRef = doc(
      db,
      "users",
      user.uid,
      "flashcards",
      flashcardId
    );
  
    await deleteDoc(flashcardRef);
  };
  