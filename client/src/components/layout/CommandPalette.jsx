import React, { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useUIStore } from '../../stores/uiStore';
import { useJobsStore } from '../../stores/jobsStore';
import { useAuthStore } from '../../stores/authStore';
import { useNavigate } from 'react-router-dom';
import styles from './CommandPalette.module.css';

/**
 * CommandPalette - Cmd+K global command system
 * Search jobs, navigate, perform actions
 */
export function CommandPalette() {
  const isOpen = useUIStore((state) => state.commandPaletteOpen);
  const toggleCommandPalette = useUIStore((state) => state.toggleCommandPalette);
  const openModal = useUIStore((state) => state.openModal);
  const success = useUIStore((state) => state.success);

  const jobs = useJobsStore((state) => state.jobs);
  const logout = useAuthStore((state) => state.logout);

  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  // Global keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleCommandPalette();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleCommandPalette]);

  if (!isOpen) return null;

  const jobCommands = jobs.slice(0, 5).map((job) => ({
    name: `View: ${job.title || 'Untitled'}`,
    subtitle: job.company || 'Unknown',
    action: () => {
      navigate(`/jobs/${job.id}`);
      setSearch('');
      toggleCommandPalette();
      success(`Opened ${job.title}`);
    },
  }));

  const commands = [
    {
      group: 'Navigation',
      items: [
        {
          name: 'Dashboard',
          action: () => {
            navigate('/');
            toggleCommandPalette();
          },
        },
        {
          name: 'Jobs Tracker',
          action: () => {
            navigate('/jobs');
            toggleCommandPalette();
          },
        },
        {
          name: 'Settings',
          action: () => {
            navigate('/settings');
            toggleCommandPalette();
          },
        },
      ],
    },
    {
      group: 'Jobs',
      items: jobCommands,
    },
    {
      group: 'Actions',
      items: [
        {
          name: 'Sync Gmail',
          action: async () => {
            toggleCommandPalette();
            const jobsStore = useJobsStore.getState();
            await jobsStore.syncGmail();
          },
        },
        {
          name: 'Setup MFA',
          action: () => {
            openModal('mfaSetup');
            toggleCommandPalette();
          },
        },
        {
          name: 'Manage Sessions',
          action: () => {
            openModal('sessions');
            toggleCommandPalette();
          },
        },
        {
          name: 'Upgrade Plan',
          action: () => {
            openModal('upgrade', { minTier: 'pro', feature: 'premium features' });
            toggleCommandPalette();
          },
        },
      ],
    },
    {
      group: 'Account',
      items: [
        {
          name: 'Logout',
          action: async () => {
            await logout();
            navigate('/login');
            toggleCommandPalette();
          },
        },
      ],
    },
  ];

  return (
    <div className={styles.overlay} onClick={() => toggleCommandPalette()}>
      <div className={styles.container} onClick={(e) => e.stopPropagation()}>
        <Command className={styles.command} shouldFilter={false}>
          <Command.Input
            placeholder="Search jobs, actions, settings..."
            value={search}
            onValueChange={setSearch}
            className={styles.input}
          />

          <Command.List className={styles.list}>
            {commands.map((group) => {
              const filtered = group.items.filter(
                (item) =>
                  !search ||
                  item.name.toLowerCase().includes(search.toLowerCase()) ||
                  (item.subtitle &&
                    item.subtitle.toLowerCase().includes(search.toLowerCase()))
              );

              if (filtered.length === 0) return null;

              return (
                <Command.Group key={group.group} heading={group.group} className={styles.group}>
                  {filtered.map((item) => (
                    <Command.Item
                      key={item.name}
                      value={item.name}
                      onSelect={item.action}
                      className={styles.item}
                    >
                      <div className={styles.itemContent}>
                        <span className={styles.itemName}>{item.name}</span>
                        {item.subtitle && (
                          <span className={styles.itemSubtitle}>{item.subtitle}</span>
                        )}
                      </div>
                    </Command.Item>
                  ))}
                </Command.Group>
              );
            })}

            {search && (
              <div className={styles.empty}>
                No results found for "{search}"
              </div>
            )}
          </Command.List>

          <div className={styles.footer}>
            <p className={styles.hint}>
              <kbd className={styles.key}>Esc</kbd> to close
            </p>
          </div>
        </Command>
      </div>
    </div>
  );
}
