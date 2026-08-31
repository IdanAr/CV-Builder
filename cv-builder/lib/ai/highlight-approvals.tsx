import type { ReactNode } from 'react'

/**
 * Marks AI-generated phrases that couldn't be traced back to the user's
 * original notes (the hallucination guard's pendingApprovals). The `role`
 * + `aria-label` on the <mark> itself (not just a `title` tooltip) is what
 * makes this discoverable to screen-reader users, not just sighted users
 * relying on the amber background color.
 */
export function highlightApprovals(text: string, approvals: string[]): ReactNode {
  if (approvals.length === 0) return <>{text}</>
  let nodes: Array<string | ReactNode> = [text]
  for (const phrase of approvals) {
    const nextNodes: Array<string | ReactNode> = []
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      if (typeof node !== 'string') {
        nextNodes.push(node)
        continue
      }
      const lowerNode = node.toLowerCase()
      const idx = lowerNode.indexOf(phrase.toLowerCase())
      if (idx === -1) {
        nextNodes.push(node)
        continue
      }
      if (idx > 0) nextNodes.push(node.slice(0, idx))
      nextNodes.push(
        <mark
          key={`${i}-${phrase}`}
          role="note"
          aria-label={`Unverified: not in your original notes, please check before using — ${node.slice(idx, idx + phrase.length)}`}
          title="Not in your original notes - please verify before accepting"
          className="rounded bg-amber-200 px-0.5 text-amber-900"
        >
          {node.slice(idx, idx + phrase.length)}
        </mark>
      )
      if (idx + phrase.length < node.length) {
        nextNodes.push(node.slice(idx + phrase.length))
      }
    }
    nodes = nextNodes
  }
  return <>{nodes}</>
}
