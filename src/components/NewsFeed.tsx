import Check from "lucide-react/dist/esm/icons/check";
import Copy from "lucide-react/dist/esm/icons/copy";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import PackageIcon from "lucide-react/dist/esm/icons/package";
import { useRef, useState } from "react";
import type { NewsFilter, NewsItem } from "../lib/news";
import { installCommand, packagePath } from "../lib/packages";

type Props = {
  items: NewsItem[];
  today: string;
};

const filters: Array<{ label: string; value: NewsFilter }> = [
  { label: "All", value: "all" },
  { label: "Formulae", value: "formula" },
  { label: "Casks", value: "cask" },
];

function previousDate(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

function dateHeading(date: string, today: string) {
  if (date === today) return "Today";
  if (date === previousDate(today)) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function publishedTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}

export default function NewsFeed({ items, today }: Props) {
  const [filter, setFilter] = useState<NewsFilter>("all");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyTimer = useRef<number | null>(null);
  const todayCount = items.filter((item) => item.publishedAt.startsWith(today)).length;
  const visibleItems = filter === "all" ? items : items.filter((item) => item.type === filter);
  const groups = visibleItems.reduce<Map<string, NewsItem[]>>((result, item) => {
    const date = item.publishedAt.slice(0, 10);
    result.set(date, [...(result.get(date) ?? []), item]);
    return result;
  }, new Map());

  async function copyCommand(item: NewsItem) {
    await navigator.clipboard.writeText(installCommand(item));
    const key = `${item.type}:${item.slug}`;
    setCopiedKey(key);
    if (copyTimer.current) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopiedKey(null), 900);
  }

  return (
    <div className="news-feed">
      <header className="news-hero">
        <div>
          <p className="section-label">Homebrew arrivals</p>
          <h1>New formulae and casks.</h1>
          <p>Fresh packages published to the official Homebrew repositories.</p>
        </div>
      </header>

      <div className="news-toolbar">
        <fieldset className="news-filters">
          <legend className="sr-only">Filter new packages</legend>
          {filters.map((option) => (
            <button
              type="button"
              key={option.value}
              className={filter === option.value ? "is-active" : undefined}
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </fieldset>
        <span>{visibleItems.length} additions in the last 14 days</span>
      </div>

      {todayCount === 0 && filter === "all" && items.length > 0 && (
        <div className="news-today-empty" role="status">
          No new packages yet today. Here are the latest arrivals.
        </div>
      )}

      {[...groups.entries()].map(([date, dateItems]) => (
        <section className="news-day" key={date} aria-labelledby={`news-${date}`}>
          <div className="news-day-heading">
            <h2 id={`news-${date}`}>{dateHeading(date, today)}</h2>
            <span>
              {dateItems.length} {dateItems.length === 1 ? "package" : "packages"}
            </span>
          </div>
          <div className="news-grid">
            {dateItems.map((item) => {
              const itemKey = `${item.type}:${item.slug}`;
              const copied = copiedKey === itemKey;
              return (
                <article className="news-card" key={itemKey}>
                  <div className="news-card-heading">
                    <span className="news-card-icon" aria-hidden="true">
                      <PackageIcon size={23} strokeWidth={1.6} />
                    </span>
                    <div>
                      <h3>
                        <a className="news-card-main-link" href={packagePath(item)} data-astro-prefetch="hover">
                          {item.name}
                        </a>
                      </h3>
                      <div className="news-card-meta">
                        <span className={`type-label type-${item.type}`}>
                          {item.type === "formula" ? "Formula" : "Cask"}
                        </span>
                        <code>{item.version}</code>
                        <time dateTime={item.publishedAt}>{publishedTime(item.publishedAt)}</time>
                      </div>
                    </div>
                  </div>
                  <p>{item.description}</p>
                  <div className="news-card-actions">
                    <code>{installCommand(item)}</code>
                    <button
                      type="button"
                      className={copied ? "is-copied" : undefined}
                      onClick={() => copyCommand(item)}
                      aria-label={copied ? `${item.name} install command copied` : `Copy ${item.name} install command`}
                    >
                      {copied ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
                    </button>
                    <a href={item.commitUrl} aria-label={`View ${item.name} publication commit`}>
                      <ExternalLink size={16} aria-hidden="true" />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      {visibleItems.length === 0 && (
        <div className="news-empty">
          <PackageIcon size={30} strokeWidth={1.4} aria-hidden="true" />
          <strong>No new {filter === "formula" ? "formulae" : filter === "cask" ? "casks" : "packages"} yet.</strong>
          <span>Check back after the next Homebrew sync.</span>
        </div>
      )}
    </div>
  );
}
