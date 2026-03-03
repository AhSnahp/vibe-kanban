import { useState } from 'react';
import { useProjects, useCreateProject } from '@cc/hooks/use-projects';
import { ProjectCard } from './ProjectCard';
import { Plus } from '@phosphor-icons/react';

export function Dashboard() {
  const { data: projects = [], isLoading } = useProjects();
  const createProject = useCreateProject();
  const [showInput, setShowInput] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    await createProject.mutateAsync({ name });
    setNewName('');
    setShowInput(false);
  };

  return (
    <div className="p-double">
      <div className="flex items-center justify-between mb-double">
        <h1 className="text-xl font-semibold text-high">Projects</h1>
        <button
          onClick={() => setShowInput(true)}
          className="flex items-center gap-half px-base py-half bg-brand text-on-brand rounded-sm text-sm hover:bg-brand-hover"
        >
          <Plus size={14} weight="bold" />
          New Project
        </button>
      </div>

      {showInput && (
        <div className="flex items-center gap-base mb-double">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') setShowInput(false);
            }}
            placeholder="Project name..."
            className="flex-1 max-w-xs px-base py-half border rounded-sm bg-primary text-sm text-high outline-none focus:ring-1 ring-brand"
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim() || createProject.isPending}
            className="px-base py-half bg-brand text-on-brand rounded-sm text-sm hover:bg-brand-hover disabled:opacity-50"
          >
            Create
          </button>
          <button
            onClick={() => setShowInput(false)}
            className="px-base py-half text-sm text-low hover:text-normal"
          >
            Cancel
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-low">Loading projects...</p>
      ) : projects.length === 0 ? (
        <p className="text-sm text-low">
          No projects yet. Create one to get started.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-base">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
