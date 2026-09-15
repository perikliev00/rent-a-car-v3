import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createAdminUser, getAdminUsers, putUserRoles } from '../../api/admin/users';
import { getRbacCatalog } from '../../api/admin/rbac';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardBody } from '../../components/ui/Card';
import { PageLoader } from '../../components/ui/Loading';
import { toast } from '../../components/ui/toastStore';

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: getAdminUsers,
  });
  const { data: catalog, isLoading: catalogLoading } = useQuery({
    queryKey: ['admin', 'rbac'],
    queryFn: getRbacCatalog,
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [createRoleIds, setCreateRoleIds] = useState<string[]>([]);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editRoleIds, setEditRoleIds] = useState<string[]>([]);

  const roles = catalog?.roles || [];

  const createMutation = useMutation({
    mutationFn: createAdminUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setEmail('');
      setPassword('');
      setCreateRoleIds([]);
      toast('Staff user created', 'success');
    },
    onError: (err) => toast((err as Error).message, 'error'),
  });

  const rolesMutation = useMutation({
    mutationFn: ({ userId, roleIds }: { userId: string; roleIds: string[] }) =>
      putUserRoles(userId, roleIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setEditingUserId(null);
      toast('Roles updated', 'success');
    },
    onError: (err) => toast((err as Error).message, 'error'),
  });

  const roleOptions = useMemo(
    () => roles.map((r) => ({ id: r.id, label: r.name, slug: r.slug })),
    [roles]
  );

  function toggleRole(list: string[], roleId: string): string[] {
    return list.includes(roleId) ? list.filter((id) => id !== roleId) : [...list, roleId];
  }

  if (usersLoading || catalogLoading) return <PageLoader />;

  return (
    <div className="min-w-0">
      <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">Users</h1>
      <p className="mt-1 text-[var(--color-muted)]">Create staff accounts and assign roles</p>

      <div className="mt-8">
        <Card>
          <CardBody>
            <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">
              Create staff user
            </h2>
            <form
              className="mt-4 grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate({ email, password, roleIds: createRoleIds });
              }}
            >
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
              <div className="md:col-span-2">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-muted)]">
                  Roles
                </p>
                <div className="flex flex-wrap gap-3">
                  {roleOptions.map((role) => (
                    <label
                      key={role.id}
                      className="flex items-center gap-2 text-sm text-[var(--color-ink)]"
                    >
                      <input
                        type="checkbox"
                        checked={createRoleIds.includes(role.id)}
                        onChange={() => setCreateRoleIds((prev) => toggleRole(prev, role.id))}
                      />
                      {role.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Button type="submit" loading={createMutation.isPending}>
                  Create user
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>

      <div className="mt-8 space-y-4">
        {usersData?.users.map((user) => (
          <Card key={user.id}>
            <CardBody>
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="break-words font-semibold text-[var(--color-ink)]">{user.email}</h3>
                  <p className="break-words text-sm text-[var(--color-muted)]">
                    Account role: {user.role} · Staff roles:{' '}
                    {user.roles.length > 0 ? user.roles.map((r) => r.name).join(', ') : 'none'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingUserId(user.id);
                    setEditRoleIds(user.roles.map((r) => r.id));
                  }}
                >
                  Edit roles
                </Button>
              </div>

              {editingUserId === user.id && (
                <div className="mt-4 border-t border-[var(--color-line)] pt-4">
                  <div className="flex flex-wrap gap-3">
                    {roleOptions.map((role) => (
                      <label
                        key={role.id}
                        className="flex items-center gap-2 text-sm text-[var(--color-ink)]"
                      >
                        <input
                          type="checkbox"
                          checked={editRoleIds.includes(role.id)}
                          onChange={() => setEditRoleIds((prev) => toggleRole(prev, role.id))}
                        />
                        {role.label}
                      </label>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      loading={rolesMutation.isPending}
                      onClick={() =>
                        rolesMutation.mutate({ userId: user.id, roleIds: editRoleIds })
                      }
                    >
                      Save roles
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingUserId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        ))}
        {usersData?.users.length === 0 && (
          <p className="py-12 text-center text-[var(--color-muted)]">No staff users yet</p>
        )}
      </div>
    </div>
  );
}
