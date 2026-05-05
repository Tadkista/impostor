import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShieldAlert, Search, RefreshCw, Key, Ban, UserCog, Check, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  
  const [tempPassword, setTempPassword] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  
  const [editForm, setEditForm] = useState({ nick: '', role: '', isBanned: false });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/users', {
        params: { page, search, role: roleFilter, limit: 10 }
      });
      setUsers(res.data.users);
      setTotalPages(res.data.totalPages);
    } catch (err) {
      console.error('Failed to fetch users', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchUsers();
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [page, search, roleFilter]);

  const handleResetPassword = async (userId) => {
    if (!window.confirm(`Are you sure you want to reset this user's password?`)) return;
    try {
      const res = await axios.post(`/api/admin/users/${userId}/reset-password`);
      setTempPassword({ userId, pass: res.data.tempPassword });
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Error resetting password');
    }
  };

  const handleToggleBan = async (user) => {
    const action = user.isBanned ? 'unban' : 'ban';
    if (!window.confirm(`Are you sure you want to ${action} this user?`)) return;
    try {
      await axios.post(`/api/admin/users/${user._id}/ban`, { isBanned: !user.isBanned });
      fetchUsers();
    } catch (err) {
      alert('Error updating ban status');
    }
  };

  const startEdit = (user) => {
    setEditingUser(user._id);
    setEditForm({ nick: user.nick, role: user.role || 'player', isBanned: !!user.isBanned });
  };

  const cancelEdit = () => {
    setEditingUser(null);
  };

  const saveEdit = async (userId) => {
    try {
      await axios.patch(`/api/admin/users/${userId}`, editForm);
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      alert('Error saving user');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-primary" /> Admin Control
          </h1>
        </div>
        <button onClick={fetchUsers} className="btn-secondary flex items-center gap-2" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-surface p-4 border border-border">
        <div className="flex-1 relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input 
            type="text" 
            placeholder="Search by name or nick..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input w-full pl-10"
          />
        </div>
        <select 
          className="input w-full sm:w-48"
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
        >
          <option value="">All Roles</option>
          <option value="player">Player</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <div className="overflow-x-auto border border-border bg-surface">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-background">
              <th className="p-3 font-medium text-sm">User</th>
              <th className="p-3 font-medium text-sm">Role</th>
              <th className="p-3 font-medium text-sm">Stats (G/T)</th>
              <th className="p-3 font-medium text-sm">Status</th>
              <th className="p-3 font-medium text-sm text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && users.length === 0 ? (
              <tr><td colSpan="5" className="p-4 text-center text-muted">Loading users...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan="5" className="p-4 text-center text-muted">No users found.</td></tr>
            ) : users.map(user => {
              const isEditing = editingUser === user._id;
              
              return (
                <tr key={user._id} className="border-b border-border hover:bg-background/50 transition-colors">
                  <td className="p-3">
                    <div className="font-medium">{user.name}</div>
                    {isEditing ? (
                      <input 
                        className="input text-sm py-1 px-2 mt-1 w-full"
                        value={editForm.nick}
                        onChange={e => setEditForm({...editForm, nick: e.target.value})}
                      />
                    ) : (
                      <div className="text-sm text-muted">{user.nick} ({user.friendCode})</div>
                    )}
                  </td>
                  
                  <td className="p-3">
                    {isEditing ? (
                      <select 
                        className="input text-sm py-1 px-2"
                        value={editForm.role}
                        onChange={e => setEditForm({...editForm, role: e.target.value})}
                      >
                        <option value="player">Player</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <span className="px-2 py-1 text-xs border border-border bg-background">
                        {user.role || 'player'}
                      </span>
                    )}
                  </td>

                  <td className="p-3 text-sm">
                    <div className="text-muted">{user.globalPoints} / {user.totalGamePoints}</div>
                  </td>

                  <td className="p-3">
                    {user.isBanned ? (
                      <span className="text-red-500 font-medium text-sm">Banned</span>
                    ) : (
                      <span className="text-green-500 font-medium text-sm">Active</span>
                    )}
                  </td>

                  <td className="p-3 text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => saveEdit(user._id)} className="p-1 border border-border hover:bg-background"><Check className="w-4 h-4 text-green-500"/></button>
                        <button onClick={cancelEdit} className="p-1 border border-border hover:bg-background"><X className="w-4 h-4 text-red-500"/></button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => startEdit(user)} title="Edit" className="p-1 border border-border hover:bg-background"><UserCog className="w-4 h-4"/></button>
                        <button onClick={() => handleResetPassword(user._id)} title="Reset Password" className="p-1 border border-border hover:bg-background"><Key className="w-4 h-4"/></button>
                        <button onClick={() => handleToggleBan(user)} title={user.isBanned ? "Unban" : "Ban"} className={`p-1 border border-border hover:bg-background ${user.isBanned ? 'text-green-500' : 'text-red-500'}`}><Ban className="w-4 h-4"/></button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {tempPassword && (
        <div className="p-4 border border-primary bg-primary/10 flex flex-col gap-2">
          <p className="font-semibold text-primary">Password Reset Successful</p>
          <p className="text-sm">Please securely share this temporary password with the user. It will not be shown again.</p>
          <div className="font-mono text-lg bg-background p-2 border border-border select-all text-center">
            {tempPassword.pass}
          </div>
          <button onClick={() => setTempPassword(null)} className="btn-secondary self-start mt-2">Close</button>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          <button 
            disabled={page === 1} 
            onClick={() => setPage(p => p - 1)}
            className="btn-secondary px-3 py-1 text-sm disabled:opacity-50"
          >
            Prev
          </button>
          <span className="px-3 py-1 border border-border bg-surface text-sm">{page} / {totalPages}</span>
          <button 
            disabled={page === totalPages} 
            onClick={() => setPage(p => p + 1)}
            className="btn-secondary px-3 py-1 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
