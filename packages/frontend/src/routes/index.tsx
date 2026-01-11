import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Zap,
  Shield,
  Wifi,
  Code,
  ArrowRight,
  Github,
  Send,
  Landmark,
  Wallet,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="-mx-4 -mt-4 flex flex-col">
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <CTASection />
      <Footer />
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/5 via-background to-background px-4 pb-20 pt-16">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-1/4 top-0 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-1/4 top-20 h-64 w-64 rounded-full bg-chart-2/10 blur-3xl" />
      </div>

      <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 text-center">
        <div className="flex flex-col gap-3">
          <div className="mx-auto flex items-center gap-2 rounded-full border bg-card/50 px-4 py-1.5 text-sm text-muted-foreground backdrop-blur-sm">
            <Zap className="h-4 w-4 text-primary" />
            <span>Powered by Lightning, Cashu & Nostr</span>
          </div>
          <h1 className="bg-gradient-to-r from-primary via-chart-3 to-chart-2 bg-clip-text text-5xl font-bold tracking-tight text-transparent md:text-7xl">
            npub.cash
          </h1>
          <p className="text-xl text-muted-foreground md:text-2xl">
            A nostr native Lightning Address for everyone
          </p>
        </div>

        <Card className="border-primary/20 bg-card/80 backdrop-blur-sm">
          <CardContent className="px-6 py-4">
            <code className="bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-lg font-semibold text-transparent md:text-2xl">
              {"<npub|username>@npub.cash"}
            </code>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Button asChild size="lg" className="gap-2 px-6">
            <Link to="/wallet">
              <Wallet className="h-4 w-4" />
              Open Wallet
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="gap-2 px-6">
            <Link to="/wallet">
              Claim Username
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      icon: Zap,
      title: "No Sign-Up Required",
      description:
        "Use any nostr public key (npub) as your Lightning address instantly. No registration needed.",
    },
    {
      icon: Shield,
      title: "Trust Minimized",
      description:
        "Your balance is locked to your public key using cryptographic signatures.",
    },
    {
      icon: Wifi,
      title: "Offline Payments",
      description:
        "Receive payments even when offline. Cashu eCash waits for you to claim it.",
    },
    {
      icon: Code,
      title: "Open Source",
      description:
        "Built on open protocols. Fully transparent and community-driven.",
    },
  ];

  return (
    <section className="border-b bg-muted/30 px-4 py-20">
      <div className="mx-auto max-w-4xl">
        <div className="mb-12 text-center">
          <h2 className="mb-3 text-3xl font-bold md:text-4xl">
            Lightning Address,{" "}
            <span className="bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">
              Reimagined
            </span>
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Receive Lightning payments on your npub.cash address. Powered by
            eCash for privacy and nostr for identity.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="group border-border/50 bg-card/50 transition-all hover:border-primary/30 hover:bg-card hover:shadow-lg hover:shadow-primary/5"
            >
              <CardContent className="flex gap-4 p-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <feature.icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="mb-1 font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      icon: Send,
      step: 1,
      title: "Send Payment",
      description:
        "Alice sends a Lightning payment to Bob's npub.cash address",
    },
    {
      icon: Landmark,
      step: 2,
      title: "Mint eCash",
      description:
        "The payment is forwarded to a Cashu mint which creates eCash locked to Bob's key",
    },
    {
      icon: Wallet,
      step: 3,
      title: "Claim Funds",
      description:
        "When Bob comes online, he claims the eCash with his Cashu wallet",
    },
  ];

  return (
    <section className="px-4 py-20">
      <div className="mx-auto max-w-4xl">
        <div className="mb-12 text-center">
          <h2 className="mb-3 text-3xl font-bold md:text-4xl">
            How It{" "}
            <span className="bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">
              Works
            </span>
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            npub.cash uses{" "}
            <a
              href="https://docs.cashu-address.com/"
              className="text-primary underline-offset-4 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Cashu-Address
            </a>
            , a protocol combining Cashu eCash with nostr for seamless offline
            Lightning payments.
          </p>
        </div>

        <div className="relative">
          {/* Connection line */}
          <div className="absolute left-1/2 top-8 hidden h-[calc(100%-4rem)] w-px -translate-x-1/2 bg-gradient-to-b from-primary/50 via-chart-3/50 to-chart-2/50 md:block" />

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-4">
            {steps.map((item, index) => (
              <div key={item.step} className="relative flex flex-col items-center">
                {/* Step number bubble */}
                <div className="relative z-10 mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-chart-2 text-primary-foreground shadow-lg shadow-primary/25">
                  <item.icon className="h-7 w-7" />
                </div>

                {/* Mobile arrow */}
                {index < steps.length - 1 && (
                  <div className="my-2 text-muted-foreground/50 md:hidden">
                    <ArrowRight className="h-5 w-5 rotate-90" />
                  </div>
                )}

                <Card className="w-full border-border/50 bg-card/50">
                  <CardContent className="p-5 text-center">
                    <div className="mb-2 text-sm font-medium text-primary">
                      Step {item.step}
                    </div>
                    <h3 className="mb-2 font-semibold">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="border-y bg-gradient-to-r from-primary/10 via-chart-3/10 to-chart-2/10 px-4 py-16">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="mb-4 text-2xl font-bold md:text-3xl">
          Ready to get started?
        </h2>
        <p className="mb-8 text-muted-foreground">
          Create your Lightning address in seconds. No sign-up required.
        </p>
        <Button asChild size="lg" className="gap-2 px-8">
          <Link to="/wallet">
            <Zap className="h-4 w-4" />
            Launch Wallet
          </Link>
        </Button>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="px-4 py-12">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-lg font-semibold text-transparent">
            npub.cash
          </span>
        </div>

        <div className="flex gap-4">
          <a
            href="https://github.com/gudnuf/npubcash-server"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 w-10 items-center justify-center rounded-full border bg-card text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
          >
            <Github className="h-5 w-5" />
          </a>
          <a
            href="https://twitter.com/AustinKelsay"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 w-10 items-center justify-center rounded-full border bg-card text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a
            href="https://primal.net/p/npub1mhcr4j594hsrnen594d7700n2t03n8gdx83zhxzculk6sh9nhwlq7uc226"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 w-10 items-center justify-center rounded-full border bg-card text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
          </a>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Built with Lightning, Cashu eCash & Nostr
        </p>
      </div>
    </footer>
  );
}
