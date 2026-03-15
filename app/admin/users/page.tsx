'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, AlertCircle, Edit2, Trash2 } from 'lucide-react';
import Link from 'next/link';

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users');
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setUsers(data.users || []);
    } catch (err) {
      setError('Failed to load users');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      setUsers(users.filter((u) => u.id !== userId));
    } catch (err) {
      setError('Failed to delete user');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground text-sm">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Users</h1>
          <p className="text-xs text-muted-foreground">Manage admin and business owner accounts</p>
        </div>
        <Link href="/admin/users/new">
          <Button className="h-8 text-xs bg-primary text-white hover:bg-primary-dark">
            <Plus className="w-4 h-4 mr-1" />
            Create User
          </Button>
        </Link>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Users Table (Mobile) and Cards (Desktop) */}
      {users.length === 0 ? (
        <div className="bg-white border border-border rounded-lg p-8 text-center">
          <p className="text-sm text-muted-foreground">No users registered yet.</p>
        </div>
      ) : (
        <>
          {/* Table for mobile and tablet */}
          <div className="lg:hidden bg-white border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 border-b border-border">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Name</th>
                    <th className="px-3 py-2 text-left font-semibold">Email</th>
                    <th className="px-3 py-2 text-center font-semibold">Status</th>
                    <th className="px-3 py-2 text-center font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-muted/5">
                      <td className="px-3 py-2 font-medium">
                        {user.first_name} {user.last_name}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">{user.email}</td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            user.is_active
                              ? 'bg-green-50 text-green-700'
                              : 'bg-gray-50 text-gray-700'
                          }`}
                        >
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Link href={`/admin/users/edit/${user.id}`}>
                            <button className="p-1 hover:bg-muted/5 rounded transition-colors">
                              <Edit2 className="w-4 h-4 text-primary" />
                            </button>
                          </Link>
                          <button
                            onClick={() => deleteUser(user.id)}
                            className="p-1 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cards for desktop */}
          <div className="hidden lg:grid grid-cols-2 xl:grid-cols-3 gap-4">
            {users.map((user) => (
              <div key={user.id} className="bg-white border border-border rounded-lg p-4 space-y-3 hover:shadow-md transition-shadow">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {user.first_name} {user.last_name}
                  </h3>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>

                <div className="space-y-1 text-xs text-muted-foreground">
                  {user.phone && <p>📱 {user.phone}</p>}
                  <p>Role: <span className="capitalize font-medium">{user.role}</span></p>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      user.is_active
                        ? 'bg-green-50 text-green-700'
                        : 'bg-gray-50 text-gray-700'
                    }`}
                  >
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex gap-2 pt-2 border-t border-border">
                  <Link href={`/admin/users/edit/${user.id}`} className="flex-1">
                    <button className="w-full py-1.5 text-xs text-primary border border-primary rounded hover:bg-primary/5 transition-colors flex items-center justify-center gap-1">
                      <Edit2 className="w-3 h-3" />
                      Edit
                    </button>
                  </Link>
                  <button
                    onClick={() => deleteUser(user.id)}
                    className="flex-1 py-1.5 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 transition-colors flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
