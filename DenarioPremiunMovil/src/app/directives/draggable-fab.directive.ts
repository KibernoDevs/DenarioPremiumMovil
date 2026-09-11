import {
  Directive,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  Renderer2,
  inject,
} from '@angular/core';
import {
  DraggableFabPosition,
  loadDraggableFabPosition,
  saveDraggableFabPosition,
} from './draggable-fab.storage';

@Directive({
  selector: '[appDraggableFab]',
  standalone: true,
})
export class DraggableFabDirective implements OnInit, OnDestroy {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);

  @Input('appDraggableFab') fabId = '';

  private readonly dragThresholdPx = 8;
  private readonly viewportPaddingPx = 8;

  private pointerActive = false;
  private dragging = false;
  private suppressNextClick = false;
  private startPointerX = 0;
  private startPointerY = 0;
  private originTop = 0;
  private originLeft = 0;
  private activePointerId: number | null = null;

  private readonly unlisten: Array<() => void> = [];
  private clickCaptureHandler: ((event: Event) => void) | null = null;

  ngOnInit(): void {
    const host = this.el.nativeElement;
    this.renderer.addClass(host, 'app-draggable-fab');

    const savedPosition = loadDraggableFabPosition(this.resolveFabId());
    if (savedPosition) {
      this.applyPosition(savedPosition.top, savedPosition.left);
    }

    this.unlisten.push(
      this.renderer.listen(host, 'pointerdown', (event: PointerEvent) => this.onPointerDown(event)),
      this.renderer.listen(host, 'pointermove', (event: PointerEvent) => this.onPointerMove(event)),
      this.renderer.listen(host, 'pointerup', (event: PointerEvent) => this.onPointerUp(event)),
      this.renderer.listen(host, 'pointercancel', (event: PointerEvent) => this.onPointerUp(event)),
    );

    this.clickCaptureHandler = (event: Event) => this.onClick(event);
    host.addEventListener('click', this.clickCaptureHandler, true);
  }

  ngOnDestroy(): void {
    this.unlisten.forEach((dispose) => dispose());
    this.unlisten.length = 0;

    if (this.clickCaptureHandler) {
      this.el.nativeElement.removeEventListener('click', this.clickCaptureHandler, true);
      this.clickCaptureHandler = null;
    }
  }

  private resolveFabId(): string {
    const trimmedId = this.fabId.trim();
    if (trimmedId) {
      return trimmedId;
    }

    const path = window.location.pathname.replace(/\W+/g, '-');
    const className = this.el.nativeElement.className.replace(/\s+/g, '-');
    return `${path}-${className || 'fab'}`;
  }

  private onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }

    const host = this.el.nativeElement;
    const rect = host.getBoundingClientRect();

    this.pointerActive = true;
    this.dragging = false;
    this.suppressNextClick = false;
    this.startPointerX = event.clientX;
    this.startPointerY = event.clientY;
    this.originTop = rect.top;
    this.originLeft = rect.left;
    this.activePointerId = event.pointerId;

    host.setPointerCapture(event.pointerId);
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.pointerActive || this.activePointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - this.startPointerX;
    const deltaY = event.clientY - this.startPointerY;

    if (!this.dragging) {
      if (Math.hypot(deltaX, deltaY) < this.dragThresholdPx) {
        return;
      }

      this.dragging = true;
      this.renderer.addClass(this.el.nativeElement, 'app-draggable-fab-dragging');
    }

    event.preventDefault();

    const host = this.el.nativeElement;
    const width = host.offsetWidth;
    const height = host.offsetHeight;
    const maxLeft = Math.max(this.viewportPaddingPx, window.innerWidth - width - this.viewportPaddingPx);
    const maxTop = Math.max(this.viewportPaddingPx, window.innerHeight - height - this.viewportPaddingPx);

    const nextLeft = this.clamp(this.originLeft + deltaX, this.viewportPaddingPx, maxLeft);
    const nextTop = this.clamp(this.originTop + deltaY, this.viewportPaddingPx, maxTop);

    this.applyPosition(nextTop, nextLeft);
  }

  private onPointerUp(event: PointerEvent): void {
    if (!this.pointerActive || this.activePointerId !== event.pointerId) {
      return;
    }

    const host = this.el.nativeElement;

    if (this.dragging) {
      this.suppressNextClick = true;
      const rect = host.getBoundingClientRect();
      const position: DraggableFabPosition = {
        top: rect.top,
        left: rect.left,
      };
      saveDraggableFabPosition(this.resolveFabId(), position);
    }

    this.pointerActive = false;
    this.dragging = false;
    this.activePointerId = null;
    this.renderer.removeClass(host, 'app-draggable-fab-dragging');

    if (host.hasPointerCapture(event.pointerId)) {
      host.releasePointerCapture(event.pointerId);
    }
  }

  private onClick(event: Event): void {
    if (!this.suppressNextClick) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    this.suppressNextClick = false;
  }

  private applyPosition(top: number, left: number): void {
    const host = this.el.nativeElement;
    this.renderer.addClass(host, 'app-draggable-fab-positioned');
    host.style.setProperty('top', `${top}px`, 'important');
    host.style.setProperty('left', `${left}px`, 'important');
    host.style.setProperty('bottom', 'auto', 'important');
    host.style.setProperty('right', 'auto', 'important');
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}
