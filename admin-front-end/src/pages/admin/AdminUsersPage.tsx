/**
 * Staff user management and role assignment UI.
 */
import { useMemo, useState } from 'react';
// Import named exports from '@tanstack/react-query'.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// Import named exports from '../../api/admin/users'.
import { createAdminUser, getAdminUsers, putUserRoles } from '../../api/admin/users';
// Import named exports from '../../api/admin/rbac'.
import { getRbacCatalog } from '../../api/admin/rbac';
// Import named exports from '../../components/ui/Button'.
import { Button } from '../../components/ui/Button';
// Import named exports from '../../components/ui/Input'.
import { Input } from '../../components/ui/Input';
// Import named exports from '../../components/ui/Card'.
import { Card, CardBody } from '../../components/ui/Card';
// Import named exports from '../../components/ui/Loading'.
import { PageLoader } from '../../components/ui/Loading';
// Import named exports from '../../components/ui/toastStore'.
import { toast } from '../../components/ui/toastStore';

/** Staff user management and role assignment UI. */
export function AdminUsersPage() {
  // Create the query client constant.
  const queryClient = useQueryClient();
  // Destructure object properties into local variables.
  const { data: usersData, isLoading: usersLoading } = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'users'],
    // Provide the query fn field value.
    queryFn: getAdminUsers,
  });
  // Destructure object properties into local variables.
  const { data: catalog, isLoading: catalogLoading } = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'rbac'],
    // Provide the query fn field value.
    queryFn: getRbacCatalog,
  });

  // Destructure array values into local variables.
  const [email, setEmail] = useState('');
  // Destructure array values into local variables.
  const [password, setPassword] = useState('');
  // Destructure array values into local variables.
  const [createRoleIds, setCreateRoleIds] = useState<string[]>([]);
  // Destructure array values into local variables.
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  // Destructure array values into local variables.
  const [editRoleIds, setEditRoleIds] = useState<string[]>([]);

  // Create the roles constant.
  const roles = catalog?.roles || [];

  // Create the create mutation constant.
  const createMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: createAdminUser,
    // Provide the on success field value.
    onSuccess: () => {
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      // Call setEmail to perform this step.
      setEmail('');
      // Call setPassword to perform this step.
      setPassword('');
      // Call setCreateRoleIds to perform this step.
      setCreateRoleIds([]);
      // Call toast to perform this step.
      toast('Staff user created', 'success');
    },
    // Provide the on error field value.
    onError: (err) => toast((err as Error).message, 'error'),
  });

  // Create the roles mutation constant.
  const rolesMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: ({ userId, roleIds }: { userId: string; roleIds: string[] }) =>
      // Call putUserRoles to perform this step.
      putUserRoles(userId, roleIds),
    // Provide the on success field value.
    onSuccess: () => {
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      // Call setEditingUserId to perform this step.
      setEditingUserId(null);
      // Call toast to perform this step.
      toast('Roles updated', 'success');
    },
    // Provide the on error field value.
    onError: (err) => toast((err as Error).message, 'error'),
  });

  // Create the role options constant.
  const roleOptions = useMemo(
    // Continue the surrounding logic with this statement.
    () => roles.map((r) => ({ id: r.id, label: r.name, slug: r.slug })),
    // Contribute this line to the enclosing declaration or statement.
    [roles]
  );

  /** Toggle Role. */
  function toggleRole(list: string[], roleId: string): string[] {
    // Return the resulting value to the caller.
    return list.includes(roleId) ? list.filter((id) => id !== roleId) : [...list, roleId];
  }

  if (usersLoading || catalogLoading) return <PageLoader />;

  // Return control to the caller with the following value.
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
