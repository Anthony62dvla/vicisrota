/** Who runs VicisRota, for the terms, privacy policy and anywhere else the company must be named. */
export const LEGAL = {
  company: "DMST Limited",
  address: "Gemma House, 39 Lilestone Street, London NW8 8SS",
  email: "hello@vicisrota.app",
  updated: "6 October 2026",
  /** Left out of the pages until filled in. */
  companyNumber: null as string | null,
  registeredOffice: null as string | null,
  icoNumber: null as string | null,
} as const;

/** "DMST Limited, a company registered in England and Wales under company number …" */
export const registeredCompany = () =>
  `${LEGAL.company}, a company registered in England and Wales${LEGAL.companyNumber ? ` under company number ${LEGAL.companyNumber}` : ""}`;
