import { Accordion, AccordionDetails, AccordionSummary, Typography } from '@mui/material';
import { MdExpandMore } from 'react-icons/md';
import { ReactNode } from 'react';

interface AccordionPrimitiveProps {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
}

export function AccordionPrimitive({ title, children, defaultExpanded = false }: AccordionPrimitiveProps) {
  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      disableGutters
      elevation={0}
      sx={{ background: 'transparent', '&:before': { display: 'none' } }}
    >
      <AccordionSummary expandIcon={<MdExpandMore />} sx={{ padding: 0, minHeight: 0 }}>
        <Typography variant="body2">{title}</Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ padding: 0 }}>
        {children}
      </AccordionDetails>
    </Accordion>
  );
}
