//go:build darwin

package activeapp

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework AppKit -framework ApplicationServices
#import <AppKit/AppKit.h>
#import <ApplicationServices/ApplicationServices.h>
#include <stdlib.h>
#include <string.h>

static void sd_copy(char *dst, int len, NSString *value) {
	const char *s = value ? [value UTF8String] : NULL;
	strncpy(dst, s ? s : "", len - 1);
	dst[len - 1] = 0;
}

static int sd_fill(pid_t pid, char *name, int nameLen, char *bundle, int bundleLen) {
	NSRunningApplication *app = [NSRunningApplication runningApplicationWithProcessIdentifier:pid];
	if (app == nil) {
		return 0;
	}
	sd_copy(name, nameLen, [app localizedName]);
	sd_copy(bundle, bundleLen, [app bundleIdentifier]);
	return 1;
}

// The focused app per the Accessibility API. This is the only source that stays current in a
// process without a run loop; NSWorkspace's frontmostApplication goes stale in a headless host.
static int sd_focused_via_ax(char *name, int nameLen, char *bundle, int bundleLen) {
	if (!AXIsProcessTrusted()) {
		return 0;
	}
	AXUIElementRef system = AXUIElementCreateSystemWide();
	AXUIElementRef focused = NULL;
	AXError err = AXUIElementCopyAttributeValue(system, kAXFocusedApplicationAttribute, (CFTypeRef *)&focused);
	CFRelease(system);
	if (err != kAXErrorSuccess || focused == NULL) {
		return 0;
	}
	pid_t pid = 0;
	AXUIElementGetPid(focused, &pid);
	CFRelease(focused);
	return pid > 0 ? sd_fill(pid, name, nameLen, bundle, bundleLen) : 0;
}

// Without Accessibility trust, the owner of the topmost normal window is the next best signal.
static int sd_focused_via_windows(char *name, int nameLen, char *bundle, int bundleLen) {
	CFArrayRef windows = CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements, kCGNullWindowID);
	if (windows == NULL) {
		return 0;
	}
	int found = 0;
	CFIndex count = CFArrayGetCount(windows);
	for (CFIndex i = 0; i < count && !found; i++) {
		NSDictionary *info = (NSDictionary *)CFArrayGetValueAtIndex(windows, i);
		NSNumber *layer = info[(id)kCGWindowLayer];
		NSNumber *pid = info[(id)kCGWindowOwnerPID];
		if (layer == nil || [layer intValue] != 0 || pid == nil) {
			continue;
		}
		found = sd_fill([pid intValue], name, nameLen, bundle, bundleLen);
	}
	CFRelease(windows);
	return found;
}

static int sd_ax_trusted(void) { return AXIsProcessTrusted() ? 1 : 0; }

static int sd_frontmost_app(char *name, int nameLen, char *bundle, int bundleLen) {
	@autoreleasepool {
		if (sd_focused_via_ax(name, nameLen, bundle, bundleLen)) {
			return 1;
		}
		if (sd_focused_via_windows(name, nameLen, bundle, bundleLen)) {
			return 1;
		}
		NSRunningApplication *app = [[NSWorkspace sharedWorkspace] frontmostApplication];
		if (app == nil) {
			return 0;
		}
		sd_copy(name, nameLen, [app localizedName]);
		sd_copy(bundle, bundleLen, [app bundleIdentifier]);
		return 1;
	}
}
*/
import "C"

import "unsafe"

// Trusted reports whether the Accessibility API may be used; without it the window list is used.
func Trusted() bool { return C.sd_ax_trusted() == 1 }

func Current() (App, error) {
	name := (*C.char)(C.malloc(256))
	bundle := (*C.char)(C.malloc(256))
	defer C.free(unsafe.Pointer(name))
	defer C.free(unsafe.Pointer(bundle))
	if C.sd_frontmost_app(name, 256, bundle, 256) == 0 {
		return App{}, nil
	}
	return App{Name: C.GoString(name), ID: C.GoString(bundle)}, nil
}
