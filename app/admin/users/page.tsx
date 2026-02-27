'use client';

export default function UsersPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold mb-1">Users</h1>
        <p className="text-xs text-muted-foreground">Manage admin and business owner accounts</p>
      </div>

      <div className="bg-white border border-border rounded-lg p-8 text-center">
        <p className="text-sm text-muted-foreground">No users to display</p>
      </div>
    </div>
  );
}
