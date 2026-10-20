// "MP" monogram crossed by the rising green arrow (design/logo-mp.svg). Inline
// so the letters take the text color of the light or dark theme.
export default function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="160 280 700 440" role="img" aria-label="Mi Portafolio">
      <defs>
        {/* Gap cut into the letters wherever the arrow crosses them */}
        <mask id="mp-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
          <rect width="1024" height="1024" fill="#fff" />
          <polyline points="188,700 316,565 396,645 581,456 636,510 793,348" fill="none" stroke="#000" strokeWidth="74" />
          <polygon points="847,290 753,310 830,382" fill="#000" stroke="#000" strokeWidth="36" strokeLinejoin="round" />
        </mask>
      </defs>
      <g mask="url(#mp-cut)" fill="none" stroke="currentColor" strokeWidth="38" strokeLinejoin="round">
        <path d="M199 660V400C199 372 222 360 246 382L387 507L537 367V470" />
        <path d="M538 540V688H625V577H720A100 105 0 0 0 720 367H625V470" />
      </g>
      <polyline points="188,700 316,565 396,645 581,456 636,510 793,348" fill="none" stroke="#0AA66A" strokeWidth="37" />
      <polygon points="847,290 753,310 830,382" fill="#0AA66A" />
    </svg>
  )
}
