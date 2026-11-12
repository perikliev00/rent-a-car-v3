/**
 * RBAC matrix editor for role permission sets.
 */
import { useEffect, useMemo, useState } from 'react';
// Import named exports from '@tanstack/react-query'.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// Import named exports from '../../api/admin/rbac'.
import { getRbacCatalog, updateRolePermissions } from '../../api/admin/rbac';
// Import named exports from '../../components/ui/Button'.
import { Button } from '../../components/ui/Button';
// Import named exports from '../../components/ui/Card'.
import { Card, CardBody } from '../../components/ui/Card';
// Import named exports from '../../components/ui/Loading'.
import { PageLoader } from '../../components/ui/Loading';
// Import named exports from '../../components/ui/toastStore'.
import { toast } from '../../components/ui/toastStore';

/** RBAC matrix editor for role permission sets. */
export function AdminRolesPage() {
  // Create the query client constant.
  const queryClient = useQueryClient();
  // Destructure object properties into local variables.
  const { data, isLoading } = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'rbac'],
    // Provide the query fn field value.
    queryFn: getRbacCatalog,
  });

  // Destructure array values into local variables.
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  // Destructure array values into local variables.
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  // Create the roles constant.
  const roles = data?.roles || [];
  // Create the permissions constant.
  const permissions = data?.permissions || [];
  // Create the matrix constant.
  const matrix = data?.matrix || [];

  // Call useEffect to perform this step.
  useEffect(() => {
    // Evaluate the condition and enter the branch when it is true.
    if (!selectedRoleId && roles.length > 0) {
      // Create the first editable constant.
      const firstEditable = roles.find((r) => r.slug !== 'owner') || roles[0];
      // Call setSelectedRoleId to perform this step.
      setSelectedRoleId(firstEditable.id);
    }
  // Continue the surrounding logic with this statement.
  }, [roles, selectedRoleId]);

  // Call useEffect to perform this step.
  useEffect(() => {
    // Evaluate the condition and enter the branch when it is true.
    if (!selectedRoleId) return;
    // Create the entry constant.
    const entry = matrix.find((m) => m.roleId === selectedRoleId);
    // Call setSelectedKeys to perform this step.
    setSelectedKeys(entry?.permissionKeys || []);
  // Continue the surrounding logic with this statement.
  }, [selectedRoleId, matrix]);

  // Create the selected role constant.
  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  // Create the is owner constant.
  const isOwner = selectedRole?.slug === 'owner';

  // Create the by category constant.
  const byCategory = useMemo(() => {
    // Create the groups constant.
    const groups = new Map<string, typeof permissions>();
    // Iterate using the loop initializer, condition, and step.
    for (const perm of permissions) {
      // Create the cat constant.
      const cat = perm.category || 'other';
      // Evaluate the condition and enter the branch when it is true.
      if (!groups.has(cat)) groups.set(cat, []);
      // Call groups.get to perform this step.
      groups.get(cat)!.push(perm);
    }
    // Return the resulting value to the caller.
    return [...groups.entries()];
  // Continue the surrounding logic with this statement.
  }, [permissions]);

  // Create the save mutation constant.
  const saveMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: () => updateRolePermissions(selectedRoleId, selectedKeys),
    // Provide the on success field value.
    onSuccess: () => {
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'rbac'] });
      // Call toast to perform this step.
      toast('Role permissions saved', 'success');
    },
    // Provide the on error field value.
    onError: (err) => toast((err as Error).message, 'error'),
  });

  /** Toggle Key. */
  function toggleKey(key: string) {
    // Evaluate the condition and enter the branch when it is true.
    if (isOwner) return;
    // Call setSelectedKeys to perform this step.
    setSelectedKeys((prev) =>
      // Call prev.includes to perform this step.
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  if (isLoading) return <PageLoader />;

  // Return control to the caller with the following value.
  return (
    <div className="min-w-0">
      <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">Roles</h1>
      <p className="mt-1 text-[var(--color-muted)]">
        Configure the permission matrix for each staff role
      </p>

      <div className="mt-8 grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        <Card>
          <CardBody className="space-y-1">
            {roles.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => setSelectedRoleId(role.id)}
                className={`block w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors ${
                  selectedRoleId === role.id
                    ? 'bg-[var(--color-ink)] text-white'
                    : 'text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]'
                }`}
              >
                {role.name}
              </button>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">
                  {selectedRole?.name || 'Select a role'}
                </h2>
                <p className="mt-1 break-words text-sm text-[var(--color-muted)]">
                  {isOwner
                    ? 'Owner always has all permissions and cannot be edited.'
                    : selectedRole?.description || 'Toggle permissions below, then save.'}
                </p>
              </div>
              {!isOwner && (
                <Button
                  loading={saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                  disabled={!selectedRoleId}
                >
                  Save permissions
                </Button>
              )}
            </div>

            <div className="mt-6 space-y-6">
              {byCategory.map(([category, perms]) => (
                <section key={category}>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">
                    {category}
                  </h3>
                  <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                    {perms.map((perm) => (
                      <label
                        key={perm.id}
                        className={`flex items-start gap-3 rounded-xl border border-[var(--color-line)] px-3 py-2.5 text-sm ${
                          isOwner ? 'opacity-70' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={selectedKeys.includes(perm.key)}
                          disabled={isOwner}
                          onChange={() => toggleKey(perm.key)}
                        />
                        <span>
                          <span className="font-medium text-[var(--color-ink)]">{perm.name}</span>
                          <span className="mt-0.5 block text-xs text-[var(--color-muted)]">
                            {perm.key}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
