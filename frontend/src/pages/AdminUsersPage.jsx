import React, { useEffect, useState, useContext } from "react";
import api from "../api";
import { AuthContext } from "../context/AuthContext";
import LoadingScreen from "../components/LoadingScreen";
import AlertModal from "../components/AlertModal";
import ConfirmModal from "../components/ConfirmModal";
import "../styles/MaterialsPage.css";

const flattenErrors = (data) => {
  if (!data) return "Something went wrong.";
  if (typeof data === "string") return data;
  return Object.values(data).flat().join(" ");
};

const AdminUsersPage = () => {
  const { token } = useContext(AuthContext);

  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const [alertModal, setAlertModal] = useState({ show: false, type: "success", title: "", message: "" });
  const [confirmModal, setConfirmModal] = useState({ show: false, userId: null });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [usersRes, meRes] = await Promise.all([
          api.get("/users/", { headers: { Authorization: `Bearer ${token}` } }),
          api.get("/user/me/", { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        setUsers(usersRes.data);
        setCurrentUser(meRes.data);
      } catch (err) {
        console.error("Failed to fetch users:", err);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchData();
  }, [token]);

  const handleEdit = (user) => {
    setEditingId(user.id);
    setEditData({ username: user.username, email: user.email || "", role: user.role, new_password: "" });
  };

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    setEditData({ ...editData, [name]: value });
  };

  const triggerSave = (id) => {
    const isSelf = currentUser && currentUser.id === id;
    if (isSelf && editData.role !== "TEACHER") {
      setConfirmModal({ show: true, userId: id });
      return;
    }
    handleSave(id);
  };

  const handleSave = async (id) => {
    setConfirmModal({ show: false, userId: null });
    setIsSaving(true);
    try {
      const payload = {
        username: editData.username,
        email: editData.email,
        role: editData.role,
      };
      if (editData.new_password && editData.new_password.trim()) {
        payload.new_password = editData.new_password.trim();
      }

      const res = await api.put(`/users/${id}/update/`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setUsers(users.map((u) => (u.id === id ? res.data : u)));
      setEditingId(null);
      setAlertModal({ show: true, type: "success", title: "User Updated", message: "Changes saved successfully." });
    } catch (err) {
      console.error("Failed to update user:", err);
      setAlertModal({
        show: true,
        type: "error",
        title: "Update Failed",
        message: flattenErrors(err.response?.data),
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <LoadingScreen message="Loading users..." />;

  return (
    <div className="flashcards-container">
      <h2>Manage Users</h2>
      <div className="flashcards-scroll">
        {users.map((u) => (
          <div key={u.id} className="premium-flashcard-card">
            {editingId === u.id ? (
              <div className="edit-form form-grid">
                <div className="form-field-block">
                  <label>USERNAME:</label>
                  <input
                    name="username"
                    type="text"
                    disabled={isSaving}
                    className="dark-input-box"
                    value={editData.username}
                    onChange={handleFieldChange}
                  />
                </div>
                <div className="form-field-block">
                  <label>EMAIL:</label>
                  <input
                    name="email"
                    type="email"
                    disabled={isSaving}
                    className="dark-input-box"
                    value={editData.email}
                    onChange={handleFieldChange}
                  />
                </div>
                <div className="form-field-block">
                  <label>ROLE:</label>
                  <select
                    name="role"
                    disabled={isSaving}
                    className="dark-input-box"
                    value={editData.role}
                    onChange={handleFieldChange}
                  >
                    <option value="STUDENT">Student</option>
                    <option value="TEACHER">Teacher</option>
                  </select>
                </div>
                <div className="form-field-block">
                  <label>NEW PASSWORD (LEAVE BLANK TO KEEP UNCHANGED):</label>
                  <input
                    name="new_password"
                    type="password"
                    disabled={isSaving}
                    className="dark-input-box"
                    value={editData.new_password}
                    onChange={handleFieldChange}
                  />
                </div>
                <div className="flashcard-actions">
                  <button
                    onClick={() => triggerSave(u.id)}
                    disabled={isSaving}
                    className={`submit-button edit-btn ${isSaving ? "btn-disabled" : ""}`}
                  >
                    {isSaving ? "⏳ Saving..." : "💾 Save"}
                  </button>
                  <button onClick={() => setEditingId(null)} disabled={isSaving} className="submit-button delete-btn">
                    ❌ Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="card-badge-row">
                  <span className={`badge ${u.role === "TEACHER" ? "active-badge" : "topic-badge"}`}>
                    {u.role === "TEACHER" ? "Teacher" : "Student"}
                  </span>
                  {u.id === currentUser?.id && <span className="badge type-badge">You</span>}
                </div>
                <h3 className="premium-card-question">{u.username}</h3>
                <p className="choice-row-text">{u.email || "No email on file"}</p>
                <div className="premium-card-footer">
                  <div className="flashcard-actions">
                    <button onClick={() => handleEdit(u)} className="submit-button edit-btn">✏️ Edit</button>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <ConfirmModal
        show={confirmModal.show}
        danger
        title="Confirm Role Change"
        message="You're removing your own teacher/admin access. Continue?"
        confirmLabel="Yes, Continue"
        onConfirm={() => handleSave(confirmModal.userId)}
        onCancel={() => setConfirmModal({ show: false, userId: null })}
      />
      <AlertModal
        show={alertModal.show}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        onClose={() => setAlertModal({ ...alertModal, show: false })}
      />
    </div>
  );
};

export default AdminUsersPage;
