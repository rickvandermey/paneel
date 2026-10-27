import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [App],
		}).compileComponents();
	});

	it('shows the pairing form when nothing is paired', async () => {
		const fixture = TestBed.createComponent(App);
		await fixture.whenStable();
		expect(fixture.nativeElement.querySelector('.pair')).toBeTruthy();
	});
});
