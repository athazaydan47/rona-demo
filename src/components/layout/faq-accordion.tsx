"use client";

import { Accordion } from "radix-ui";
import { ChevronDown } from "lucide-react";

export function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  return (
    <Accordion.Root type="single" collapsible className="divide-y divide-garis rounded-card border border-garis bg-putih" data-testid="faq">
      {items.map((it, i) => (
        <Accordion.Item key={it.q} value={`faq-${i}`}>
          <Accordion.Header>
            <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 px-4 py-4 text-left text-base font-semibold text-kopi hover:bg-porselen/60 data-[state=open]:text-rona-gelap">
              {it.q}
              <ChevronDown className="size-5 shrink-0 text-abu-hangat transition-transform duration-200 ease-soft group-data-[state=open]:rotate-180" aria-hidden />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="overflow-hidden data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
            <p className="px-4 pb-4 text-sm leading-relaxed text-kopi/90">{it.a}</p>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
