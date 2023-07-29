import type { FC, PropsWithChildren } from "react"

import "@/styles/globals.css"

const Layout: FC<PropsWithChildren> = ({ children }) => (
  <html className="bg-zinc-200 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-200">
    <body className="antialiased">{children}</body>
  </html>
)

export default Layout
