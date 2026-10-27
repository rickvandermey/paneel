import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Profile } from '@sd/protocol';
import { Deck } from './deck';
import { indexAmongRealButtons } from './virtual-keys';

const profile: Profile = {
	id: 'p',
	name: 'P',
	buttons: [
		{ id: 'a', label: 'Alpha', showLabel: true, color: '#111111', actions: [] },
		{
			id: 'f',
			label: 'Folder',
			showLabel: true,
			color: '#222222',
			actions: [],
			folder: [
				{
					id: 'c',
					label: 'Child',
					showLabel: true,
					color: '#333333',
					actions: [],
				},
			],
		},
	],
};

describe('Deck', () => {
	let fixture: ComponentFixture<Deck>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [Deck],
		}).compileComponents();
		fixture = TestBed.createComponent(Deck);
		fixture.componentRef.setInput('profile', profile);
		await fixture.whenStable();
	});

	it('renders the root keys', () => {
		expect(fixture.nativeElement.querySelectorAll('sd-deck-key').length).toBe(2);
	});

	it('opens folders in place with a back key and emits presses for actions', async () => {
		const pressed: string[] = [];
		fixture.componentInstance.pressed.subscribe((button) => pressed.push(button.id));
		fixture.componentInstance.onKeyPressed(profile.buttons[1]);
		await fixture.whenStable();
		const labels = Array.from(fixture.nativeElement.querySelectorAll('.key__label')).map(
			(el) => (el as HTMLElement).textContent,
		);
		expect(labels).toEqual(['Back', 'Child']);
		fixture.componentInstance.onKeyPressed(fixture.componentInstance.visibleButtons()[1]);
		expect(pressed).toEqual(['c']);
		fixture.componentInstance.onKeyPressed(fixture.componentInstance.visibleButtons()[0]);
		await fixture.whenStable();
		expect(fixture.componentInstance.folderPath()).toEqual([]);
	});

	it('splits into sets and swipes horizontally between them', async () => {
		// A deck area that holds one key at the minimum size, so two root keys need two sets.
		fixture.componentInstance.viewport.set({ width: 80, height: 80 });
		await fixture.whenStable();
		expect(fixture.componentInstance.sets().length).toBe(2);
		fixture.componentInstance.onPointerDown({
			clientX: 300,
			clientY: 100,
			pointerId: 1,
		} as PointerEvent);
		fixture.componentInstance.onPointerUp({
			clientX: 100,
			clientY: 110,
			pointerId: 1,
		} as PointerEvent);
		expect(fixture.componentInstance.setIndex()).toBe(1);
	});

	it('reports vertical swipes as profile changes', () => {
		const swipes: string[] = [];
		fixture.componentInstance.profileSwipe.subscribe((direction) => swipes.push(direction));
		fixture.componentInstance.onPointerDown({
			clientX: 100,
			clientY: 400,
			pointerId: 2,
		} as PointerEvent);
		fixture.componentInstance.onPointerUp({
			clientX: 110,
			clientY: 100,
			pointerId: 2,
		} as PointerEvent);
		expect(swipes).toEqual(['next']);
	});
});

describe('Deck keeps its place across config updates', () => {
	it('stays inside the open folder when the same profile arrives as a new object', async () => {
		await TestBed.configureTestingModule({
			imports: [Deck],
		}).compileComponents();
		const fixture = TestBed.createComponent(Deck);
		fixture.componentRef.setInput('profile', profile);
		await fixture.whenStable();
		fixture.componentInstance.openFolder('f');
		expect(fixture.componentInstance.folderPath()).toEqual(['f']);
		fixture.componentRef.setInput('profile', structuredClone(profile));
		await fixture.whenStable();
		expect(fixture.componentInstance.folderPath()).toEqual(['f']);
		fixture.componentRef.setInput('profile', {
			...structuredClone(profile),
			id: 'other',
		});
		await fixture.whenStable();
		expect(fixture.componentInstance.folderPath()).toEqual([]);
	});
});

describe('indexAmongRealButtons', () => {
	const key = (id: string) => ({
		id,
		showLabel: true,
		color: '#000000',
		actions: [],
	});

	it('skips the back and add keys when computing the list index', () => {
		const visible = [key('__back'), key('a'), key('b'), key('__add')];
		expect(indexAmongRealButtons(visible, 'a')).toBe(0);
		expect(indexAmongRealButtons(visible, 'b')).toBe(1);
		expect(indexAmongRealButtons(visible, '__add')).toBeNull();
		expect(indexAmongRealButtons(visible, 'missing')).toBeNull();
	});
});
