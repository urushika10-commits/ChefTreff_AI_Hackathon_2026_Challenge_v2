import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'

interface Props {
  children: string
  className?: string
}

// Shared remark/rehype plugin arrays — defined once, reused everywhere.
// remark-math parses $...$ and $$...$$ as math nodes.
// rehype-katex renders them with KaTeX (CSS imported in main.tsx).
const remarkPlugins = [remarkMath]
const rehypePlugins = [rehypeKatex]

export default function MarkdownRenderer({ children, className = 'prose-custom' }: Props) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
