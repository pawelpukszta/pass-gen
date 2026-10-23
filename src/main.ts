import './styles.css';
import { startApp } from './ui/app';

startApp();

// Entry fade-up for [data-reveal] blocks; without motion (or the API) everything stays visible.
if (matchMedia('(prefers-reduced-motion: no-preference)').matches && 'IntersectionObserver' in window) {
  document.documentElement.classList.add('reveal-on');
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('in');
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.08 });
  document.querySelectorAll('[data-reveal]').forEach((node) => observer.observe(node));
}
