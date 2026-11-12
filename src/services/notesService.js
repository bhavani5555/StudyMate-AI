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
  
  export const saveNoteToCloud = async (note) => {
    const user = auth.currentUser;
  
    if (!user) {
      throw new Error("Please login to save your notes.");
    }
  
    const notesRef = collection(db, "users", user.uid, "notes");
    const docRef = await addDoc(notesRef, note);
  
    return { ...note, id: docRef.id };
  };
  
  export const getCloudNotes = async () => {
    const user = auth.currentUser;
  
    if (!user) {
      throw new Error("Please login to access your notes.");
    }
  
    const notesRef = collection(db, "users", user.uid, "notes");
  
    const notesQuery = query(
      notesRef,
      orderBy("createdAt", "desc")
    );
  
    const snapshot = await getDocs(notesQuery);
  
    return snapshot.docs.map((document) => ({
      id: document.id,
      ...document.data()
    }));
  };
  
  export const deleteCloudNote = async (noteId) => {
    const user = auth.currentUser;
  
    if (!user) {
      throw new Error("Please login to delete your notes.");
    }
  
    const noteRef = doc(db, "users", user.uid, "notes", noteId);
  
    await deleteDoc(noteRef);
  };