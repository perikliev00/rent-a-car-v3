import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRbacCatalog, updateRolePermissions } from '../../api/admin/rbac';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { PageLoader } from '../../components/ui/Loading';
import { toast } from '../../components/ui/toastStore';

export function AdminRolesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'rbac'],
    queryFn: getRbacCatalog,
  });

  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const roles = data?.roles || [];
  const permissions = data?.permissions || [];
  const matrix = data?.matrix || [];

  useEffect(() => {
    if (!selectedRoleId && roles.length > 0) {
      const firstEditable = roles.find((r) => r.slug !== 'owner') || roles[0];
      setSelectedRoleId(firstEditable.id);
    }
  }, [roles, selectedRoleId]);

  useEffect(() => {
    if (!selectedRoleId) return;
    const entry = matrix.find((m) => m.roleId === selectedRoleId);
    setSelectedKeys(entry?.permissionKeys || []);
  }, [selectedRoleId, matrix]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const isOwner = selectedRole?.slug === 'owner';

  const byCategory = useMemo(() => {
    const groups = new Map<string, typeof permissions>();
    for (const perm of permissions) {
      const cat = perm.category || 'other';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(perm);
    }
    return [...groups.entries()];
  }, [permissions]);

  const saveMutation = useMutation({
    mutationFn: () => updateRolePermissions(selectedRoleId, selectedKeys),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rbac'] });
      toast('Role permissions saved', 'success');
    },
    onError: (err) => toast((err as Error).message, 'error'),
  });

  function toggleKey(key: string) {
    if (isOwner) return;
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  if (isLoading) return <PageLoader />;

  return (
    <div>
      <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">Roles</h1>
      <p className="mt-1 text-[var(--color-muted)]">
        Configure the permission matrix for each staff role
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[220px_1fr]">
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
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">
                  {selectedRole?.name || 'Select a role'}
                </h2>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
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
                  <div className="grid gap-2 sm:grid-cols-2">
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
