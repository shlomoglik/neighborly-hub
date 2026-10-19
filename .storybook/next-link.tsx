import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from "react";

type StorybookLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string | { pathname?: string; query?: Record<string, string | number | boolean> };
  children?: ReactNode;
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean | null;
  shallow?: boolean;
  locale?: string | false;
};

const Link = forwardRef<HTMLAnchorElement, StorybookLinkProps>(function Link(
  { href, replace: _replace, scroll: _scroll, prefetch: _prefetch, shallow: _shallow, locale: _locale, ...props },
  ref,
) {
  const url =
    typeof href === "string"
      ? href
      : `${href.pathname ?? "/"}${href.query ? `?${new URLSearchParams(Object.entries(href.query).map(([key, value]) => [key, String(value)])).toString()}` : ""}`;
  return <a {...props} href={url} ref={ref} onClick={(event) => { event.preventDefault(); props.onClick?.(event); }} />;
});

export default Link;
