//go:build darwin

package icons

/*
#cgo CFLAGS: -x objective-c -fobjc-arc
#cgo LDFLAGS: -framework AppKit
#import <AppKit/AppKit.h>
#include <stdlib.h>
#include <string.h>

// appIconPNG renders the Finder icon of a path as PNG through NSWorkspace, which handles
// .icns resources as well as icons shipped in Assets.car.
static unsigned char *sd_app_icon_png(const char *path, int size, int *length) {
	@autoreleasepool {
		NSString *nsPath = [NSString stringWithUTF8String:path];
		NSImage *image = [[NSWorkspace sharedWorkspace] iconForFile:nsPath];
		if (image == nil) {
			*length = 0;
			return NULL;
		}
		NSRect rect = NSMakeRect(0, 0, size, size);
		CGImageRef cgImage = [image CGImageForProposedRect:&rect context:nil hints:nil];
		if (cgImage == NULL) {
			*length = 0;
			return NULL;
		}
		NSBitmapImageRep *rep = [[NSBitmapImageRep alloc] initWithCGImage:cgImage];
		[rep setSize:NSMakeSize(size, size)];
		NSData *data = [rep representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
		if (data == nil) {
			*length = 0;
			return NULL;
		}
		*length = (int)[data length];
		unsigned char *buffer = (unsigned char *)malloc([data length]);
		memcpy(buffer, [data bytes], [data length]);
		return buffer;
	}
}
*/
import "C"

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"unsafe"
)

var searchDirs = []string{"/Applications", "/System/Applications", "/System/Applications/Utilities", "/Applications/Utilities"}

func appIconPNG(ctx context.Context, target string) ([]byte, error) {
	appPath, err := resolveAppPath(ctx, target)
	if err != nil {
		return nil, err
	}
	cPath := C.CString(appPath)
	defer C.free(unsafe.Pointer(cPath))
	var length C.int
	buffer := C.sd_app_icon_png(cPath, 256, &length)
	if buffer == nil || length == 0 {
		return nil, fmt.Errorf("%w: AppKit returned no icon for %s", ErrNoIcon, appPath)
	}
	defer C.free(unsafe.Pointer(buffer))
	return C.GoBytes(unsafe.Pointer(buffer), length), nil
}

func resolveAppPath(ctx context.Context, target string) (string, error) {
	if strings.HasSuffix(target, ".app") || strings.HasPrefix(target, "/") {
		if _, err := os.Stat(target); err == nil {
			return target, nil
		}
	}
	name := strings.TrimSuffix(target, ".app")
	home, _ := os.UserHomeDir()
	for _, dir := range append(searchDirs, filepath.Join(home, "Applications")) {
		candidate := filepath.Join(dir, name+".app")
		if _, err := os.Stat(candidate); err == nil {
			return candidate, nil
		}
	}
	query := fmt.Sprintf(`kMDItemContentType == "com.apple.application-bundle" && kMDItemDisplayName == "%s"c`, name)
	output, err := exec.CommandContext(ctx, "mdfind", query).Output()
	if err == nil {
		for _, line := range strings.Split(strings.TrimSpace(string(output)), "\n") {
			if strings.HasSuffix(line, ".app") {
				return line, nil
			}
		}
	}
	return "", fmt.Errorf("%w: application %q not found", ErrNoIcon, target)
}
