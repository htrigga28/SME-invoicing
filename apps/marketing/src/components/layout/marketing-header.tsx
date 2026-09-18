"use client";

import { ChevronDown, LogIn, Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { type FocusEvent, useEffect, useRef, useState } from "react";

import { BrandLogo } from "@/components/brand/brand-logo";
import { SignupAnchor } from "@/components/ui/signup-anchor";
import { navigation } from "@/content/site-copy";
import { cn } from "@/lib/cn";
import { getAppLoginUrl, getMarketingAnchorHref } from "@/lib/urls";

export function MarketingHeader() {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isProductOpen, setIsProductOpen] = useState(false);
  const [isMobileProductOpen, setIsMobileProductOpen] = useState(false);
  const loginUrl = getAppLoginUrl();

  const resolveHref = (href: `#${string}`) => getMarketingAnchorHref(pathname, href);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        setIsProductOpen(false);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      const node = headerRef.current;
      if (node && event.target instanceof Node && !node.contains(event.target)) {
        setIsProductOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  function onProductBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsProductOpen(false);
    }
  }

  function closeMobileNavigation() {
    setIsOpen(false);
    setIsMobileProductOpen(false);
  }

  return (
    <header className={cn("marketing-header", isScrolled && "is-scrolled")} ref={headerRef}>
      <div className="header-shell">
        <a aria-label="Lumina home" className="brand-home" href="/">
          <BrandLogo />
        </a>

        <nav aria-label="Primary" className="desktop-navigation">
          <div
            className={cn("product-navigation", isProductOpen && "is-open")}
            onBlur={onProductBlur}
            onMouseEnter={() => setIsProductOpen(true)}
            onMouseLeave={() => setIsProductOpen(false)}
          >
            <button
              aria-controls="product-menu"
              aria-expanded={isProductOpen}
              aria-haspopup="true"
              className="navigation-link"
              onClick={() => setIsProductOpen((current) => !current)}
              type="button"
            >
              {navigation.productLabel}
              <ChevronDown aria-hidden="true" className={cn(isProductOpen && "rotate-180")} />
            </button>

            {isProductOpen ? (
              <div className="product-menu" id="product-menu">
                {navigation.productItems.map((item) => (
                  <a
                    className="product-menu-link"
                    href={resolveHref(item.href)}
                    key={item.id}
                    onClick={() => setIsProductOpen(false)}
                  >
                    <span>{item.label}</span>
                    <small>{item.detail}</small>
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          {navigation.links.map((link) => (
            <a className="navigation-link" href={resolveHref(link.href)} key={link.href}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="desktop-actions">
          <a className="sign-in-link" href={loginUrl}>
            <LogIn aria-hidden="true" />
            {navigation.signInLabel}
          </a>
          <SignupAnchor>{navigation.signupLabel}</SignupAnchor>
        </div>

        <button
          aria-controls="mobile-navigation"
          aria-expanded={isOpen}
          aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
          className="mobile-menu-button"
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          {isOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>

      {isOpen ? (
        <div className="mobile-navigation" id="mobile-navigation">
          <nav aria-label="Mobile primary">
            <button
              aria-expanded={isMobileProductOpen}
              className="mobile-product-trigger"
              onClick={() => setIsMobileProductOpen((current) => !current)}
              type="button"
            >
              {navigation.productLabel}
              <ChevronDown aria-hidden="true" className={cn(isMobileProductOpen && "rotate-180")} />
            </button>
            {isMobileProductOpen ? (
              <div className="mobile-product-links">
                {navigation.productItems.map((item) => (
                  <a href={resolveHref(item.href)} key={item.id} onClick={closeMobileNavigation}>
                    <strong>{item.label}</strong>
                    <span>{item.detail}</span>
                  </a>
                ))}
              </div>
            ) : null}
            {navigation.links.map((link) => (
              <a href={resolveHref(link.href)} key={link.href} onClick={closeMobileNavigation}>
                {link.label}
              </a>
            ))}
            <div className="mobile-actions">
              <a href={loginUrl}>
                <LogIn aria-hidden="true" />
                {navigation.signInLabel}
              </a>
              <SignupAnchor className="w-full" onClick={closeMobileNavigation}>
                {navigation.signupLabel}
              </SignupAnchor>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
