import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [App],
		}).compileComponents();
	});

	it('renders the title', async () => {
		const fixture = TestBed.createComponent(App);
		await fixture.whenStable();
		expect(fixture.nativeElement.querySelector('h1').textContent).toContain('Paneel');
	});
});
