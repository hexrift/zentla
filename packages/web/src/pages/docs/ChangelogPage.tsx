import { SEO } from "../../components/SEO";
import changelogRaw from "../../../../../CHANGELOG.md?raw";

// Parse changelog entries from raw markdown
function parseChangelog(raw: string) {
  const lines = raw.split("\n");
  const entries: Array<{
    version: string;
    date: string;
    sections: Array<{
      type: string;
      items: string[];
    }>;
  }> = [];

  let currentEntry: (typeof entries)[0] | null = null;
  let currentSection: (typeof entries)[0]["sections"][0] | null = null;

  for (const line of lines) {
    // Match version headers like "## [5.0.1](url) (2026-01-04)"
    const versionMatch = line.match(
      /^## \[([^\]]+)\].*\((\d{4}-\d{2}-\d{2})\)/,
    );
    if (versionMatch) {
      if (currentEntry) {
        if (currentSection) {
          currentEntry.sections.push(currentSection);
        }
        entries.push(currentEntry);
      }
      currentEntry = {
        version: versionMatch[1],
        date: versionMatch[2],
        sections: [],
      };
      currentSection = null;
      continue;
    }

    // Match section headers like "### Features" or "### Bug Fixes"
    const sectionMatch = line.match(/^### (.+)/);
    if (sectionMatch && currentEntry) {
      if (currentSection) {
        currentEntry.sections.push(currentSection);
      }
      currentSection = {
        type: sectionMatch[1],
        items: [],
      };
      continue;
    }

    // Match list items
    if (line.startsWith("* ") && currentSection) {
      // Clean up the markdown - remove scope prefix and links
      let item = line.slice(2);
      // Remove **scope:** prefix
      item = item.replace(/^\*\*[^*]+\*\*:\s*/, "");
      // Remove markdown links, keep text
      item = item.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
      // Remove commit hashes in parentheses
      item = item.replace(/\s*\([a-f0-9]+\)\s*$/, "");
      currentSection.items.push(item);
    }
  }

  // Don't forget the last entry
  if (currentEntry) {
    if (currentSection) {
      currentEntry.sections.push(currentSection);
    }
    entries.push(currentEntry);
  }

  return entries;
}

const entries = parseChangelog(changelogRaw);

function getSectionIcon(type: string) {
  switch (type.toLowerCase()) {
    case "features":
      return (
        <span className="w-5 h-5 rounded bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-bold">
          +
        </span>
      );
    case "bug fixes":
      return (
        <span className="w-5 h-5 rounded bg-amber-100 text-amber-600 flex items-center justify-center text-xs font-bold">
          !
        </span>
      );
    default:
      return (
        <span className="w-5 h-5 rounded bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold">
          ~
        </span>
      );
  }
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function ChangelogPage() {
  return (
    <article className="prose-docs">
      <SEO
        title="Changelog"
        description="See what's new in Zentla. Track all features, improvements, and bug fixes."
        path="/docs/changelog"
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Docs", path: "/docs" },
          { name: "Changelog", path: "/docs/changelog" },
        ]}
      />
      <h1>Changelog</h1>
      <p className="lead text-lg text-gray-600 mb-8">
        Track all features, improvements, and bug fixes in Zentla.
      </p>

      <div className="not-prose space-y-8">
        {entries.slice(0, 20).map((entry) => (
          <div
            key={entry.version}
            id={`v${entry.version}`}
            className="border border-gray-200 rounded-xl overflow-hidden"
          >
            <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-gray-900">
                  v{entry.version}
                </span>
                <span className="text-sm text-gray-500">
                  {formatDate(entry.date)}
                </span>
              </div>
              <a
                href={`https://github.com/hexrift/zentla/releases/tag/v${entry.version}`}
                target="_blank"
                rel="noopener"
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                View on GitHub
              </a>
            </div>
            <div className="px-5 py-4 space-y-4">
              {entry.sections.map((section, idx) => (
                <div key={idx}>
                  <div className="flex items-center gap-2 mb-2">
                    {getSectionIcon(section.type)}
                    <h4 className="text-sm font-medium text-gray-700">
                      {section.type}
                    </h4>
                  </div>
                  <ul className="space-y-1 ml-7">
                    {section.items.map((item, itemIdx) => (
                      <li
                        key={itemIdx}
                        className="text-sm text-gray-600 list-disc ml-4"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {entry.sections.length === 0 && (
                <p className="text-sm text-gray-500 italic">
                  Minor updates and maintenance.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="not-prose mt-8 p-6 bg-gray-50 rounded-xl text-center">
        <p className="text-sm text-gray-600 mb-3">
          Looking for older releases?
        </p>
        <a
          href="https://github.com/hexrift/zentla/releases"
          target="_blank"
          rel="noopener"
          className="text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          View all releases on GitHub
        </a>
      </div>
    </article>
  );
}
