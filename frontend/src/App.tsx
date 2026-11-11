import { useLanguage } from "./i18n";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  GraduationCap,
  LayoutGrid,
  Lightbulb,
  Plus,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { errorMessage, readIdentity } from "./api/client";
import { useLogin, useTopics, useTopicMutation, useUsers } from "./api/hooks";
import { TopicCard, initials } from "./components/TopicCard";
import { TopicForm, type FormMode } from "./components/TopicForm";
import { Modal } from "./components/Modal";
import type { Identity, Status, Topic } from "./types";
export default function App() {
  const { t, language, setLanguage, locale, number } = useLanguage();
  const tabs: { status: Status; label: string; icon: typeof LayoutGrid }[] = [
    { status: "PROPOSED", label: t("Voting board"), icon: LayoutGrid },
    { status: "SCHEDULED", label: t("Upcoming sessions"), icon: CalendarDays },
    { status: "COMPLETED", label: t("Past archives"), icon: BookOpen },
  ];
  const [identity, setIdentity] = useState<Identity | null>(readIdentity);
  const [tab, setTab] = useState<Status>("PROPOSED");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("ALL");
  const [sort, setSort] = useState("votes");
  const [form, setForm] = useState<FormMode | null>(null);
  const [help, setHelp] = useState(false);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState<unknown>(null);
  const users = useUsers();
  const topics = useTopics(identity?.user.id);
  const login = useLogin();
  const mutation = useTopicMutation();
  const client = useQueryClient();
  const all = topics.data || [];
  const visible = useMemo(
    () =>
      all
        .filter(
          (topic) =>
            topic.status === tab &&
            (kind === "ALL" || topic.kind === kind) &&
            (
              topic.title +
              " " +
              topic.description +
              " " +
              topic.proposer.name +
              " " +
              (topic.presenter?.name || "")
            )
              .toLowerCase()
              .includes(search.toLowerCase()),
        )
        .sort((a, b) =>
          tab === "SCHEDULED"
            ? Date.parse(a.scheduled_at || "") -
              Date.parse(b.scheduled_at || "")
            : tab === "COMPLETED"
              ? Date.parse(b.scheduled_at || b.updated_at) -
                Date.parse(a.scheduled_at || a.updated_at)
              : sort === "votes"
                ? b.vote_count - a.vote_count ||
                  Date.parse(b.created_at) - Date.parse(a.created_at)
                : Date.parse(b.created_at) - Date.parse(a.created_at),
        ),
    [all, tab, search, kind, sort],
  );
  const next = [...all]
    .filter((topic) => topic.status === "SCHEDULED")
    .sort(
      (a, b) =>
        Date.parse(a.scheduled_at || "") - Date.parse(b.scheduled_at || ""),
    )[0];
  async function switchUser(value: string) {
    setNotice("");
    setActionError(null);
    if (!value) {
      localStorage.removeItem("knowledgesync.identity");
      setIdentity(null);
      return;
    }
    try {
      const result = await login.mutateAsync(Number(value));
      localStorage.setItem("knowledgesync.identity", JSON.stringify(result));
      setIdentity(result);
      await client.invalidateQueries({ queryKey: ["topics"] });
    } catch (error) {
      setActionError(error);
    }
  }
  async function act(topic: Topic, action: "vote" | "claim") {
    setNotice("");
    setActionError(null);
    try {
      await mutation.mutateAsync({
        path: "topics/" + topic.id + "/" + action + "/",
      });
      if (action === "claim")
        setNotice("You’re on! Schedule your session whenever you’re ready.");
    } catch (error) {
      setActionError(error);
    }
  }
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="/" aria-label={t("KnowledgeSync home")}>
            <span className="brand-mark">
              <GraduationCap size={25} strokeWidth={1.7} />
            </span>
            <span>
              {language === "fa" ? (
                "هم‌آموز"
              ) : (
                <>
                  Knowledge<span className="brand-light">Sync</span>
                </>
              )}
              <small>{t("GOOD IDEAS TRAVEL TOGETHER")}</small>
            </span>
          </a>
          <div className="header-actions">
            <div
              className="language-switch"
              role="group"
              aria-label={t("Language")}
            >
              <button
                type="button"
                lang="en"
                aria-pressed={language === "en"}
                onClick={() => setLanguage("en")}
              >
                English
              </button>
              <button
                type="button"
                lang="fa"
                aria-pressed={language === "fa"}
                onClick={() => setLanguage("fa")}
              >
                فارسی
              </button>
            </div>
            <span className="team-space">
              <span className="live-dot" />
              {t("Our team’s learning space")}
            </span>
            <div className="user-select">
              <span className="avatar avatar-0">
                {identity ? initials(identity.user.name) : <Users size={17} />}
              </span>
              <label className="sr-only" htmlFor="identity">
                {t("Choose your team identity")}
              </label>
              <select
                id="identity"
                value={identity?.user.id || ""}
                onChange={(event) => switchUser(event.target.value)}
                disabled={login.isPending || users.isLoading}
              >
                <option value="">
                  {users.isLoading ? t("Loading team…") : t("Choose your name")}
                </option>
                {users.data?.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} />
            </div>
          </div>
        </div>
      </header>
      <main>
        <section className="intro-row">
          <div>
            <p className="eyebrow">
              <span className="tiny-line" />
              {t("THE MORE WE SHARE, THE MORE WE GROW")}
            </p>
            <h1>{t("Big ideas. Small sessions.")}</h1>
            <p className="intro-copy">
              {t(
                "A little of what you know. A little of what you’re curious about.",
              )}
              <br className="desktop-break" />{" "}
              {t("A whole lot we can learn from each other.")}
            </p>
          </div>
          <button
            className="button primary propose-button"
            disabled={!identity}
            onClick={() => setForm({ type: "propose" })}
          >
            <Plus size={18} />
            {t("Propose a topic")}
          </button>
        </section>
        <section
          className="overview-grid"
          aria-label={t("Learning at a glance")}
        >
          <div className="stats-panel">
            <div className="stat">
              <span className="stat-icon">
                <Lightbulb size={19} />
              </span>
              <div>
                <strong>
                  {number(
                    all.filter((topic) => topic.status === "PROPOSED").length,
                    2,
                  )}
                </strong>
                <span>{t("Ideas in the making")}</span>
              </div>
            </div>
            <div className="stat">
              <span className="stat-icon peach">
                <CalendarDays size={19} />
              </span>
              <div>
                <strong>
                  {number(
                    all.filter((topic) => topic.status === "SCHEDULED").length,
                    2,
                  )}
                </strong>
                <span>{t("Sessions coming up")}</span>
              </div>
            </div>
            <div className="stat">
              <span className="stat-icon lavender">
                <BookOpen size={19} />
              </span>
              <div>
                <strong>
                  {number(
                    all.filter((topic) => topic.status === "COMPLETED").length,
                    2,
                  )}
                </strong>
                <span>{t("Things we’ve learned")}</span>
              </div>
            </div>
          </div>
          <button
            className="next-session"
            onClick={() => {
              setTab("SCHEDULED");
              setSearch("");
              setKind("ALL");
            }}
          >
            <span className="next-icon">
              <Sparkles size={22} />
            </span>
            <div>
              <span className="next-label">
                {t("UP NEXT")}
                {next?.scheduled_at &&
                  " · " +
                    new Date(next.scheduled_at).toLocaleDateString(locale, {
                      month: "short",
                      day: "numeric",
                    })}
              </span>
              <strong>
                {next?.title || t("Your next great learning moment")}
              </strong>
            </div>
            <ArrowUpRight size={20} />
          </button>
        </section>
        {!identity && (
          <div className="identity-note">
            <Users size={17} />
            <span>
              {t(
                "Make yourself at home. Choose your name above to vote, share an idea, or volunteer to present.",
              )}
            </span>
          </div>
        )}
        {users.isError && (
          <div className="error-banner" role="alert">
            {errorMessage(users.error, language)}{" "}
            <button onClick={() => users.refetch()}>
              {t("Retry team list")}
            </button>
          </div>
        )}
        {!!actionError && (
          <div className="error-banner" role="alert">
            {errorMessage(actionError, language)}
          </div>
        )}
        {notice && (
          <div className="notice" role="status">
            <span>{t(notice)}</span>
            <button
              className="icon-button"
              aria-label={t("Dismiss notification")}
              onClick={() => {
                setNotice("");
                setActionError(null);
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}
        <section className="board-section">
          <div className="tabs-row">
            <nav className="tabs" aria-label={t("Session categories")}>
              {tabs.map(({ status, label, icon: Icon }) => (
                <button
                  key={status}
                  className={tab === status ? "active" : ""}
                  aria-current={tab === status ? "page" : undefined}
                  onClick={() => {
                    setTab(status);
                    setKind("ALL");
                    setSearch("");
                  }}
                >
                  <Icon size={17} />
                  {label}
                  <span>
                    {number(
                      all.filter((topic) => topic.status === status).length,
                    )}
                  </span>
                </button>
              ))}
            </nav>
            <button className="how-it-works" onClick={() => setHelp(true)}>
              <CircleHelp size={15} />
              {t("How it works")}
            </button>
          </div>
          <div className="board-heading">
            <div>
              <h2>
                {tab === "PROPOSED"
                  ? t("What should we learn next?")
                  : tab === "SCHEDULED"
                    ? t("Make room for something new.")
                    : t("Good knowledge, kept close.")}
              </h2>
              <p>
                {tab === "PROPOSED"
                  ? t(
                      "Vote for what sparks your curiosity. Help shape our next session.",
                    )
                  : tab === "SCHEDULED"
                    ? t(
                        "Save a spot in your calendar. Bring your questions and your curiosity.",
                      )
                    : t(
                        "Revisit the conversations and takeaways we’ve shared along the way.",
                      )}
              </p>
            </div>
            <span className="topic-total">
              {number(visible.length)}{" "}
              {t(tab === "PROPOSED" ? "topics" : "sessions")}
            </span>
          </div>
          <div className="filter-row">
            <div className="kind-filter" aria-label={t("Filter topic type")}>
              {[
                ["ALL", t("All topics")],
                ["OFFER", t("Offers to share")],
                ["REQUEST", t("Requests to learn")],
              ].map(([value, label]) => (
                <button
                  key={value}
                  aria-pressed={kind === value}
                  className={kind === value ? "selected" : ""}
                  onClick={() => setKind(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="search-sort">
              <label className="search">
                <Search size={17} />
                <input
                  aria-label={t("Search topics")}
                  placeholder={t("Search topics…")}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                {search && (
                  <button
                    aria-label={t("Clear search")}
                    onClick={() => setSearch("")}
                  >
                    <X size={14} />
                  </button>
                )}
              </label>
              {tab === "PROPOSED" && (
                <label className="sort-label">
                  <span>{t("Sort by:")}</span>
                  <select
                    aria-label={t("Sort topics")}
                    value={sort}
                    onChange={(event) => setSort(event.target.value)}
                  >
                    <option value={"votes"}>{t("Most voted")}</option>
                    <option value="newest">{t("Newest first")}</option>
                  </select>
                </label>
              )}
            </div>
          </div>
          {topics.isLoading ? (
            <div className="topic-grid" aria-label={t("Loading topics")}>
              {[1, 2, 3].map((value) => (
                <div className="skeleton" key={value} />
              ))}
            </div>
          ) : topics.isError ? (
            <div className="empty-state" role="alert">
              <CircleHelp size={28} />
              <h3>{t("We couldn’t load the learning board.")}</h3>
              <p>{errorMessage(topics.error, language)}</p>
              <button
                className="button secondary"
                onClick={() => topics.refetch()}
              >
                {t("Try again")}
              </button>
            </div>
          ) : visible.length ? (
            <div className="topic-grid">
              {visible.map((topic) => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  user={identity?.user || null}
                  busy={mutation.isPending}
                  onVote={() => act(topic, "vote")}
                  onClaim={() => act(topic, "claim")}
                  onForm={setForm}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Lightbulb size={30} />
              <h3>
                {search || kind !== "ALL"
                  ? t("No topics match just yet.")
                  : tab === "PROPOSED"
                    ? t("A good idea starts with you.")
                    : tab === "SCHEDULED"
                      ? t("The calendar is open.")
                      : t("Our learning story is just beginning.")}
              </h3>
              <p>
                {search || kind !== "ALL"
                  ? t("Try a different search or explore all topic types.")
                  : t("Propose a topic and help the team learn something new.")}
              </p>
              <button
                className="button secondary"
                disabled={!identity && !search && kind === "ALL"}
                onClick={() => {
                  if (search || kind !== "ALL") {
                    setSearch("");
                    setKind("ALL");
                  } else setForm({ type: "propose" });
                }}
              >
                {search || kind !== "ALL"
                  ? t("Clear filters")
                  : t("Propose a topic")}
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </section>
        <aside className="gentle-note">
          <span className="note-icon">
            <MicIllustration />
          </span>
          <div>
            <strong>{t("You don’t need to be an expert to share.")}</strong>
            <p>
              {t(
                "A handy trick, a lesson learned, a question worth exploring. It all belongs here.",
              )}
            </p>
          </div>
          <button onClick={() => setHelp(true)}>
            {t("A little inspiration")}
            <ArrowRight size={16} />
          </button>
        </aside>
      </main>
      <footer>
        <span>
          <GraduationCap size={17} />
          {language === "fa" ? "هم‌آموز" : "KnowledgeSync"}
        </span>
        <p>{t("Built on curiosity. Better together.")}</p>
        <span className="footer-right">
          <span className="live-dot" />
          {t("Made for our team")}
        </span>
      </footer>
      {form && <TopicForm mode={form} onClose={() => setForm(null)} />}
      {help && (
        <Modal
          title={t("Everyone has something to share.")}
          description={t(
            "A small space for peer-to-peer learning. Here’s how we make it happen.",
          )}
          onClose={() => setHelp(false)}
        >
          <ol className="help-steps">
            <li>
              <span>{number(1)}</span>
              <div>
                <strong>{t("Start with a spark")}</strong>
                <p>
                  {t(
                    "Choose your name, then offer a lightning talk or request something you’d love to learn.",
                  )}
                </p>
              </div>
            </li>
            <li>
              <span>{number(2)}</span>
              <div>
                <strong>{t("Let curiosity lead")}</strong>
                <p>
                  {t(
                    "Vote for ideas you want to hear about. If you can help with a request, volunteer to present.",
                  )}
                </p>
              </div>
            </li>
            <li>
              <span>{number(3)}</span>
              <div>
                <strong>{t("Put it on the calendar")}</strong>
                <p>
                  {t(
                    "Presenters choose a time and meeting link. Everyone can download a calendar event.",
                  )}
                </p>
              </div>
            </li>
            <li>
              <span>
                <Check size={16} />
              </span>
              <div>
                <strong>{t("Keep the knowledge flowing")}</strong>
                <p>
                  {t(
                    "Afterward, the presenter marks the session complete and can share slides or a recap in the archives.",
                  )}
                </p>
              </div>
            </li>
          </ol>
          <button
            className="button primary help-done"
            onClick={() => setHelp(false)}
          >
            {t("Got it. Let’s learn.")}
            <ArrowRight size={17} />
          </button>
        </Modal>
      )}
    </div>
  );
}
function MicIllustration() {
  return <Lightbulb size={26} strokeWidth={1.5} />;
}
