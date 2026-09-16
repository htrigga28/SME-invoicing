"use client";

import { ArrowUpRight, ChevronDown, LogIn, Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { type FocusEvent, useEffect, useMemo, useRef, useState } from "react";

import { BrandLogo } from "@/components/brand/brand-logo";
import { NairaText } from "@/components/ui/naira-text";
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
  const [activeProductId, setActiveProductId] = useState(navigation.productItems[0]!.id);
  const reduceMotion = usePrefersReducedMotion();
  const productMenuRef = useRef<HTMLDivElement>(null);
  const productPreviewRef = useRef<HTMLDivElement>(null);
  const loginUrl = getAppLoginUrl();
  const activeProduct = useMemo(
    () =>
      navigation.productItems.find((item) => item.id === activeProductId) ??
      navigation.productItems[0]!,
    [activeProductId]
  );

  const resolveHref = (href: `#${string}`) => getMarketingAnchorHref(pathname, href);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const menu = productMenuRef.current;
    if (!menu || !isProductOpen) return;
    let disposed = false;
    let revert = () => {};
    void import("gsap").then(({ gsap }) => {
      if (disposed) return;
      const context = gsap.context(() => {
        gsap.fromTo(menu, { opacity: 0, y: -8, filter: "blur(6px)" }, {
          duration: 0.24, opacity: 1, y: 0, filter: "blur(0px)", ease: "power2.out"
        });
      }, menu);
      revert = () => context.revert();
    }).catch(() => undefined);
    return () => { disposed = true; revert(); };
  }, [isProductOpen, reduceMotion]);

  useEffect(() => {
    if (reduceMotion || !isProductOpen || !productPreviewRef.current) return;
    let disposed = false;
    let revert = () => {};
    void import("gsap").then(({ gsap }) => {
      if (disposed || !productPreviewRef.current) return;
      const context = gsap.context(() => {
        gsap.fromTo(productPreviewRef.current, { opacity: 0, x: 12, filter: "blur(6px)" }, {
          duration: 0.24, opacity: 1, x: 0, filter: "blur(0px)", ease: "power2.out"
        });
      }, productPreviewRef.current);
      revert = () => context.revert();
    }).catch(() => undefined);
    return () => { disposed = true; revert(); };
  }, [activeProductId, isProductOpen, reduceMotion]);

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
              <div className="product-menu" id="product-menu" ref={productMenuRef}>
                <div className="product-menu-list">
                  {navigation.productItems.map((item) => (
                    <a
                      className={cn("product-menu-link", item.id === activeProductId && "is-active")}
                      href={resolveHref(item.href)}
                      key={item.id}
                      onClick={() => setIsProductOpen(false)}
                      onFocus={() => setActiveProductId(item.id)}
                      onMouseEnter={() => setActiveProductId(item.id)}
                    >
                      <span>{item.label}</span>
                      <small>{item.detail}</small>
                    </a>
                  ))}
                </div>
                <div className="product-menu-preview" aria-live="polite" ref={productPreviewRef}>
                  <span className="data-label">{activeProduct.label.toUpperCase()}</span>
                  <strong>{activeProduct.title}</strong>
                  <p><NairaText value={activeProduct.preview} /></p>
                  <span className="preview-action">
                    Explore section <ArrowUpRight aria-hidden="true" />
                  </span>
                </div>
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

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return;
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  return reduced;
}
