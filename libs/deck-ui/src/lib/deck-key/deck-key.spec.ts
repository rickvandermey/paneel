import { TestBed } from '@angular/core/testing';
import { DeckKey, REPEAT_DELAY_MS, REPEAT_INTERVAL_MS } from './deck-key';

describe('DeckKey toggle look', () => {
	it('shows the second-state label, color and icon while on', async () => {
		await TestBed.configureTestingModule({
			imports: [DeckKey],
		}).compileComponents();
		const fixture = TestBed.createComponent(DeckKey);
		fixture.componentRef.setInput('button', {
			id: 'm',
			label: 'Mute',
			showLabel: true,
			color: '#111111',
			icon: { source: 'phosphor', name: 'speaker-slash' },
			actions: [],
			toggle: {
				label: 'Unmute',
				color: '#222222',
				icon: { source: 'phosphor', name: 'speaker-high' },
				actions: [],
			},
		});
		await fixture.whenStable();
		expect(fixture.nativeElement.querySelector('.key__label').textContent.trim()).toBe('Mute');
		fixture.componentRef.setInput('on', true);
		await fixture.whenStable();
		expect(fixture.nativeElement.querySelector('.key__label').textContent.trim()).toBe(
			'Unmute',
		);
		expect(fixture.componentInstance.color()).toBe('#222222');
		expect(fixture.nativeElement.querySelector('i.ph-speaker-high')).not.toBeNull();
	});
});

describe('DeckKey repeat', () => {
	it('keeps emitting while held when the button repeats', async () => {
		await TestBed.configureTestingModule({
			imports: [DeckKey],
		}).compileComponents();
		const fixture = TestBed.createComponent(DeckKey);
		fixture.componentRef.setInput('button', {
			id: 'v',
			label: 'Volume up',
			showLabel: true,
			color: '#111111',
			actions: [],
			repeat: true,
		});
		await fixture.whenStable();
		let presses = 0;
		fixture.componentInstance.pressed.subscribe(() => presses++);
		const event = {
			button: 0,
			pointerType: 'mouse',
			pointerId: 1,
			currentTarget: null,
		} as unknown as PointerEvent;
		fixture.componentInstance.onPointerDown(event);
		expect(presses).toBe(1);
		// Real timers: a tap stays one press, a hold adds presses at the repeat pace.
		await new Promise((resolve) =>
			setTimeout(resolve, REPEAT_DELAY_MS + REPEAT_INTERVAL_MS * 2 + 60),
		);
		expect(presses).toBeGreaterThanOrEqual(3);
		fixture.componentInstance.stopRepeat();
		const after = presses;
		await new Promise((resolve) => setTimeout(resolve, REPEAT_INTERVAL_MS * 3));
		expect(presses).toBe(after);
	});
});
