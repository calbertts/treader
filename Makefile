DISTDIR=dist
uname_s := $(shell uname -s)
uname_m := $(shell uname -m)
dist_m := $(shell cat /etc/*-release | grep ^ID=[A-Za-z]* | sed s/ID=/-/g | sed s/\"//g)

$(info os=$(uname_s))
$(info arch=$(uname_m))
$(info dist=$(dist_m))

treader:
	mkdir -p $(DISTDIR)
	qjsc -o ./$(DISTDIR)/treader-$(uname_s)$(dist_m)-$(uname_m) index.js
	strip ./$(DISTDIR)/treader-$(uname_s)$(dist_m)-$(uname_m)
	chmod a+x ./$(DISTDIR)/treader-$(uname_s)$(dist_m)-$(uname_m)

clean:
	rm -rf $(DISTDIR)
