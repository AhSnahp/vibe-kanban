import { Link } from '@tanstack/react-router';
import type { Project } from '@cc/lib/api';

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: project.id }}
      className="flex items-center gap-base p-base border rounded-sm bg-primary hover:bg-secondary transition-colors"
    >
      <div
        className="h-3 w-3 rounded-full shrink-0"
        style={{ backgroundColor: project.color }}
      />
      <span className="text-sm font-medium text-high truncate">
        {project.name}
      </span>
    </Link>
  );
}
