// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
import type React from "react";
import type { Metadata } from "next";
import "./globals.css";

// InterDisplay is self-hosted from public/fonts via @font-face in globals.css,
// exactly as the real app loads it (scss/_fonts.scss). No next/font here: the
// real files are .otf and the family name has to stay "InterDisplay" so the
// class strings copied out of the .vue sources resolve identically.

export const metadata: Metadata = {
  title: "Carfinity v2 UI kit",
  description: "Dark, dense dealer-dashboard components ported from the v2 Vue app.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="app-dark h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
