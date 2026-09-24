import {
  Check,
  MessageCircle,
  X,
} from 'lucide-react';

import NavPanel from '../../components/NavPanel';
import { useData } from '../../data/DataContext';

export default function NotificationsPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { db, resolveNotification } = useData();

  const pendingNotifications =
    db.notifications.filter(
      (notification) =>
        notification.status === 'pending'
    );

  const resolvedNotifications =
    db.notifications.filter(
      (notification) =>
        notification.status !== 'pending'
    );

  return (
    <NavPanel
      open={open}
      onClose={onClose}
      title="Notifications"
    >
      <div className="flex flex-col gap-5 px-5 py-5">

        {/* Pending requests */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Chat Requests
              </p>

              <h3 className="mt-1 text-sm font-semibold text-white">
                People wanting to connect
              </h3>
            </div>

            {pendingNotifications.length > 0 && (
              <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white/10 px-2 text-xs font-semibold text-cyan-100">
                {pendingNotifications.length}
              </span>
            )}
          </div>

          {pendingNotifications.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-8 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
                <MessageCircle className="h-5 w-5 text-cyan-200" />
              </div>

              <p className="mt-3 text-sm font-medium text-white">
                You're all caught up
              </p>

              <p className="mt-1 text-xs text-white/40">
                New chat requests will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingNotifications.map(
                (notification) => {
                  const user =
                    db.users[
                      notification.userId
                    ];

                  if (!user) return null;

                  return (
                    <div
                      key={notification.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 transition hover:bg-white/[0.09]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-white/25 bg-white/10">
                          {user.pic ? (
                            <img
                              src={user.pic}
                              alt={user.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
                              {user.name
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">
                            {user.name}
                          </p>

                          <p className="mt-0.5 text-xs text-white/45">
                            wants to chat with you
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            resolveNotification(
                              notification.id,
                              'accepted'
                            )
                          }
                          className="flex items-center justify-center gap-2 rounded-full bg-white py-2.5 text-xs font-semibold text-[#3d2fb0] transition hover:bg-white/90"
                        >
                          <Check className="h-4 w-4" />
                          Accept
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            resolveNotification(
                              notification.id,
                              'declined'
                            )
                          }
                          className="flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.07] py-2.5 text-xs font-semibold text-white/70 transition hover:bg-white/[0.12] hover:text-white"
                        >
                          <X className="h-4 w-4" />
                          Decline
                        </button>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </section>

        {/* Previous notifications */}
        {resolvedNotifications.length > 0 && (
          <section className="border-t border-white/10 pt-5">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
              Previous
            </p>

            <div className="space-y-2">
              {resolvedNotifications.map(
                (notification) => {
                  const user =
                    db.users[
                      notification.userId
                    ];

                  if (!user) return null;

                  return (
                    <div
                      key={notification.id}
                      className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-3"
                    >
                      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white/10">
                        {user.pic ? (
                          <img
                            src={user.pic}
                            alt={user.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-white/60">
                            {user.name
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                        )}
                      </div>

                      <p className="min-w-0 flex-1 truncate text-xs text-white/45">
                        <span className="font-medium text-white/65">
                          {user.name}
                        </span>{' '}
                        was {notification.status}
                      </p>

                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          notification.status ===
                          'accepted'
                            ? 'bg-cyan-300'
                            : 'bg-white/25'
                        }`}
                      />
                    </div>
                  );
                }
              )}
            </div>
          </section>
        )}
      </div>
    </NavPanel>
  );
}