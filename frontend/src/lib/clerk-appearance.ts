/**
 * Tema de Clerk mapeado al sistema visual de BBJobs (ver docs/planning/implementacion/sistema-visual.md).
 * `elevation: 'flush'` en options quita el borde/sombra propio de Clerk — el componente vive
 * embebido dentro de nuestra propia card (login/register), no duplicamos el marco.
 */
export const clerkAppearance = {
  variables: {
    colorPrimary: "#1E8EA3",
    colorPrimaryForeground: "#FFFFFF",
    colorBackground: "#FFFFFF",
    colorInput: "#FAFBFD",
    colorInputForeground: "#1C2230",
    colorForeground: "#1C2230",
    colorMutedForeground: "#64748B",
    colorDanger: "#EE4444",
    colorBorder: "#DDE3EC",
    borderRadius: "0.75rem",
    fontFamily: "var(--font-sans)",
    fontFamilyButtons: "var(--font-display)",
  },
  elements: {
    rootBox: "w-full",
    card: "bg-transparent shadow-none border-none p-0 w-full",
    headerTitle: "font-display font-bold text-[#1C2230]",
    headerSubtitle: "text-[#64748B]",
    socialButtonsBlockButton:
      "border border-[#DDE3EC] hover:bg-[#FAFBFD] text-[#1C2230] font-semibold",
    dividerLine: "bg-[#DDE3EC]",
    dividerText: "text-[#64748B]",
    formFieldLabel: "text-[#1C2230] font-bold text-sm",
    formFieldInput:
      "border border-[#DDE3EC] rounded-xl bg-[#FAFBFD] focus:border-[#1E8EA3] focus:ring-2 focus:ring-[#1E8EA3]/20",
    formButtonPrimary:
      "bg-[#1E8EA3] hover:bg-[#187B8E] text-white font-bold rounded-xl normal-case",
    footerActionLink: "text-[#1E8EA3] font-bold hover:text-[#187B8E]",
    identityPreviewEditButton: "text-[#1E8EA3]",
    formResendCodeLink: "text-[#1E8EA3] font-bold",
    footer: "hidden",
  },
  options: {
    elevation: "flush",
    socialButtonsPlacement: "top",
    socialButtonsVariant: "blockButton",
  },
} as const;
