import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sidebar from '@/components/Sidebar';
import { Project } from '@/lib/types';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  FileText: () => <div data-testid="file-text-icon" />,
  LayoutList: () => <div data-testid="layout-list-icon" />,
  Calendar: () => <div data-testid="calendar-icon" />,
  Code: () => <div data-testid="code-icon" />,
}));

// Mock CSS modules
jest.mock('@/components/Sidebar.module.css', () => ({
  sidebar: 'sidebar',
  header: 'header',
  title: 'title',
  nav: 'nav',
  navSection: 'navSection',
  navTitle: 'navTitle',
  navItem: 'navItem',
  active: 'active',
}));

describe('Sidebar', () => {
  const mockProjects: Project[] = [
    {
      id: 'project-1',
      title: 'Project One',
      tasks: [],
      path: '/data/project-1.md',
    },
    {
      id: 'project-2',
      title: 'Project Two',
      tasks: [],
      path: '/data/project-2.md',
    },
    {
      id: 'project-3',
      title: 'Project Three',
      tasks: [],
      path: '/data/project-3.md',
    },
  ];

  const defaultProps = {
    projects: mockProjects,
    currentView: 'tree' as const,
    currentProjectId: 'project-1',
    onViewChange: jest.fn(),
    onProjectSelect: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render the app title', () => {
      render(<Sidebar {...defaultProps} />);

      expect(screen.getByText('Markdown Todo')).toBeInTheDocument();
    });

    it('should render all view buttons', () => {
      render(<Sidebar {...defaultProps} />);

      expect(screen.getByText('Tree')).toBeInTheDocument();
      expect(screen.getByText('Calendar')).toBeInTheDocument();
      expect(screen.getByText('Markdown')).toBeInTheDocument();
    });

    it('should render all projects', () => {
      render(<Sidebar {...defaultProps} />);

      expect(screen.getByText('Project One')).toBeInTheDocument();
      expect(screen.getByText('Project Two')).toBeInTheDocument();
      expect(screen.getByText('Project Three')).toBeInTheDocument();
    });

    it('should render empty projects list', () => {
      render(<Sidebar {...defaultProps} projects={[]} />);

      expect(screen.queryByText('Project One')).not.toBeInTheDocument();
      expect(screen.getByText('Projects')).toBeInTheDocument();
    });

    it('should render view icons', () => {
      render(<Sidebar {...defaultProps} />);

      expect(screen.getByTestId('layout-list-icon')).toBeInTheDocument();
      expect(screen.getByTestId('calendar-icon')).toBeInTheDocument();
      expect(screen.getByTestId('code-icon')).toBeInTheDocument();
    });

    it('should render project icons', () => {
      render(<Sidebar {...defaultProps} />);

      const fileIcons = screen.getAllByTestId('file-text-icon');
      expect(fileIcons).toHaveLength(mockProjects.length);
    });
  });

  describe('view selection', () => {
    it('should highlight active tree view', () => {
      render(<Sidebar {...defaultProps} currentView="tree" />);

      const treeButton = screen.getByText('Tree').closest('button');
      expect(treeButton).toHaveClass('active');
    });

    it('should highlight active calendar view', () => {
      render(<Sidebar {...defaultProps} currentView="weekly" />);

      const calendarButton = screen.getByText('Calendar').closest('button');
      expect(calendarButton).toHaveClass('active');
    });

    it('should highlight active markdown view', () => {
      render(<Sidebar {...defaultProps} currentView="md" />);

      const mdButton = screen.getByText('Markdown').closest('button');
      expect(mdButton).toHaveClass('active');
    });

    it('should only highlight one view at a time', () => {
      render(<Sidebar {...defaultProps} currentView="tree" />);

      const treeButton = screen.getByText('Tree').closest('button');
      const calendarButton = screen.getByText('Calendar').closest('button');
      const mdButton = screen.getByText('Markdown').closest('button');

      expect(treeButton).toHaveClass('active');
      expect(calendarButton).not.toHaveClass('active');
      expect(mdButton).not.toHaveClass('active');
    });

    it('should call onViewChange when tree view is clicked', async () => {
      render(<Sidebar {...defaultProps} currentView="weekly" />);

      const treeButton = screen.getByText('Tree');
      await userEvent.click(treeButton);

      expect(defaultProps.onViewChange).toHaveBeenCalledWith('tree');
    });

    it('should call onViewChange when calendar view is clicked', async () => {
      render(<Sidebar {...defaultProps} currentView="tree" />);

      const calendarButton = screen.getByText('Calendar');
      await userEvent.click(calendarButton);

      expect(defaultProps.onViewChange).toHaveBeenCalledWith('weekly');
    });

    it('should call onViewChange when markdown view is clicked', async () => {
      render(<Sidebar {...defaultProps} currentView="tree" />);

      const mdButton = screen.getByText('Markdown');
      await userEvent.click(mdButton);

      expect(defaultProps.onViewChange).toHaveBeenCalledWith('md');
    });

    it('should allow clicking already active view', async () => {
      render(<Sidebar {...defaultProps} currentView="tree" />);

      const treeButton = screen.getByText('Tree');
      await userEvent.click(treeButton);

      expect(defaultProps.onViewChange).toHaveBeenCalledWith('tree');
    });
  });

  describe('project selection', () => {
    it('should highlight active project', () => {
      render(<Sidebar {...defaultProps} currentProjectId="project-2" />);

      const project2Button = screen.getByText('Project Two').closest('button');
      expect(project2Button).toHaveClass('active');
    });

    it('should only highlight one project at a time', () => {
      render(<Sidebar {...defaultProps} currentProjectId="project-1" />);

      const project1Button = screen.getByText('Project One').closest('button');
      const project2Button = screen.getByText('Project Two').closest('button');

      expect(project1Button).toHaveClass('active');
      expect(project2Button).not.toHaveClass('active');
    });

    it('should call onProjectSelect when project is clicked', async () => {
      render(<Sidebar {...defaultProps} />);

      const project2Button = screen.getByText('Project Two');
      await userEvent.click(project2Button);

      expect(defaultProps.onProjectSelect).toHaveBeenCalledWith('project-2');
    });

    it('should call onProjectSelect for each project', async () => {
      render(<Sidebar {...defaultProps} />);

      for (const project of mockProjects) {
        const projectButton = screen.getByText(project.title);
        await userEvent.click(projectButton);

        expect(defaultProps.onProjectSelect).toHaveBeenCalledWith(project.id);
      }
    });

    it('should allow clicking already active project', async () => {
      render(<Sidebar {...defaultProps} currentProjectId="project-1" />);

      const project1Button = screen.getByText('Project One');
      await userEvent.click(project1Button);

      expect(defaultProps.onProjectSelect).toHaveBeenCalledWith('project-1');
    });

    it('should handle no active project', () => {
      render(<Sidebar {...defaultProps} currentProjectId={undefined} />);

      const project1Button = screen.getByText('Project One').closest('button');
      expect(project1Button).not.toHaveClass('active');
    });

    it('should handle non-existent active project ID', () => {
      render(<Sidebar {...defaultProps} currentProjectId="non-existent" />);

      const project1Button = screen.getByText('Project One').closest('button');
      expect(project1Button).not.toHaveClass('active');
    });
  });

  describe('navigation structure', () => {
    it('should render Views section header', () => {
      render(<Sidebar {...defaultProps} />);

      expect(screen.getByText('Views')).toBeInTheDocument();
    });

    it('should render Projects section header', () => {
      render(<Sidebar {...defaultProps} />);

      expect(screen.getByText('Projects')).toBeInTheDocument();
    });

    it('should have aside element as root', () => {
      const { container } = render(<Sidebar {...defaultProps} />);

      const aside = container.querySelector('aside');
      expect(aside).toBeInTheDocument();
      expect(aside).toHaveClass('sidebar');
    });

    it('should have nav element for navigation', () => {
      const { container } = render(<Sidebar {...defaultProps} />);

      const nav = container.querySelector('nav');
      expect(nav).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should render view buttons as buttons', () => {
      render(<Sidebar {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      const viewButtonTexts = ['Tree', 'Calendar', 'Markdown'];

      viewButtonTexts.forEach(text => {
        const button = buttons.find(btn => btn.textContent?.includes(text));
        expect(button).toBeDefined();
      });
    });

    it('should render project buttons as buttons', () => {
      render(<Sidebar {...defaultProps} />);

      mockProjects.forEach(project => {
        const button = screen.getByText(project.title).closest('button');
        expect(button).toBeInTheDocument();
      });
    });

    it('should render buttons that support keyboard navigation', () => {
      render(<Sidebar {...defaultProps} />);

      const treeButton = screen.getByText('Tree').closest('button');

      // Verify it's a real button element (which is keyboard accessible)
      expect(treeButton).toBeInTheDocument();
      expect(treeButton?.tagName).toBe('BUTTON');
    });
  });

  describe('edge cases', () => {
    it('should handle projects with long titles', () => {
      const longTitleProject = {
        id: 'long',
        title: 'A'.repeat(100),
        tasks: [],
        path: '/data/long.md',
      };

      render(<Sidebar {...defaultProps} projects={[longTitleProject]} />);

      expect(screen.getByText('A'.repeat(100))).toBeInTheDocument();
    });

    it('should handle projects with special characters in titles', () => {
      const specialProject = {
        id: 'special',
        title: 'Project with "quotes" & <brackets>',
        tasks: [],
        path: '/data/special.md',
      };

      render(<Sidebar {...defaultProps} projects={[specialProject]} />);

      expect(screen.getByText('Project with "quotes" & <brackets>')).toBeInTheDocument();
    });

    it('should handle many projects', () => {
      const manyProjects = Array.from({ length: 50 }, (_, i) => ({
        id: `project-${i}`,
        title: `Project ${i}`,
        tasks: [],
        path: `/data/project-${i}.md`,
      }));

      render(<Sidebar {...defaultProps} projects={manyProjects} />);

      expect(screen.getByText('Project 0')).toBeInTheDocument();
      expect(screen.getByText('Project 49')).toBeInTheDocument();
    });

    it('should handle rapid view switches', async () => {
      render(<Sidebar {...defaultProps} />);

      const treeButton = screen.getByText('Tree');
      const calendarButton = screen.getByText('Calendar');

      await userEvent.click(treeButton);
      await userEvent.click(calendarButton);
      await userEvent.click(treeButton);

      expect(defaultProps.onViewChange).toHaveBeenCalledTimes(3);
    });

    it('should handle rapid project switches', async () => {
      render(<Sidebar {...defaultProps} />);

      const project1 = screen.getByText('Project One');
      const project2 = screen.getByText('Project Two');

      await userEvent.click(project1);
      await userEvent.click(project2);
      await userEvent.click(project1);

      expect(defaultProps.onProjectSelect).toHaveBeenCalledTimes(3);
    });
  });

  describe('styling', () => {
    it('should apply active class to current view', () => {
      render(<Sidebar {...defaultProps} currentView="weekly" />);

      const calendarButton = screen.getByText('Calendar').closest('button');
      expect(calendarButton?.className).toContain('active');
    });

    it('should apply active class to current project', () => {
      render(<Sidebar {...defaultProps} currentProjectId="project-2" />);

      const project2Button = screen.getByText('Project Two').closest('button');
      expect(project2Button?.className).toContain('active');
    });

    it('should apply navItem class to all navigation items', () => {
      const { container } = render(<Sidebar {...defaultProps} />);

      const buttons = container.querySelectorAll('.navItem');
      // 3 views + 3 projects = 6 nav items
      expect(buttons.length).toBe(6);
    });
  });
});
