
import Swal from "sweetalert2";

export const confirmDelete = async (message = "Are you sure you want to delete this item?") => {
  const result = await Swal.fire({
    title: "Confirm Deletion",
    text: message,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Delete",
    cancelButtonText: "Cancel",
    reverseButtons: true,
    confirmButtonColor: "#e5484d",
    cancelButtonColor: "#64748b",
    background: document.documentElement.dataset.theme === "dark"
      ? "#1e293b"
      : "#ffffff",
    color: document.documentElement.dataset.theme === "dark"
      ? "#f8fafc"
      : "#1e293b"
  });

  return result.isConfirmed;
};
