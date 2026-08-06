import type { LucideIcon } from "lucide-react"
import {
  ArrowRightIcon,
  AtSignIcon,
  BadgeCheckIcon,
  CheckCircle2Icon,
  CircleUserRoundIcon,
  Code2Icon,
  CoinsIcon,
  ExternalLinkIcon,
  GitForkIcon,
  KeyRoundIcon,
  LandmarkIcon,
  LockKeyholeIcon,
  MonitorSmartphoneIcon,
  RadioTowerIcon,
  SendIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  TerminalIcon,
  TriangleAlertIcon,
  WalletCardsIcon,
  WifiOffIcon,
  ZapIcon,
} from "lucide-react"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const SOURCE_HREF = "https://github.com/cashubtc/npubcash-server"
const NOSTR_HREF =
  "https://primal.net/p/npub1mhcr4j594hsrnen594d7700n2t03n8gdx83zhxzculk6sh9nhwlq7uc226"

type Feature = {
  title: string
  description: string
  icon: LucideIcon
}

type WalletIntegration = {
  name: string
  description: string
  highlights: string[]
  icon: LucideIcon
  actions: Array<{
    label: string
    href: string
    primary?: boolean
  }>
}

const features: Feature[] = [
  {
    title: "No registration required",
    description:
      "Use any valid npub as npub1…@npub.cash. You only need an integrated wallet when you want to claim or manage payments.",
    icon: CircleUserRoundIcon,
  },
  {
    title: "Receive while offline",
    description:
      "A sender pays over Lightning while npub.cash tracks the paid mint quote. Your wallet can claim the ecash when you return.",
    icon: WifiOffIcon,
  },
  {
    title: "Choose your mint",
    description:
      "Use the provider's default Cashu mint or set a compatible preferred mint for future payments.",
    icon: LandmarkIcon,
  },
  {
    title: "Optional quote locking",
    description:
      "With a NUT-20-compatible mint, you can request quotes locked to your Nostr public key for additional protection.",
    icon: LockKeyholeIcon,
  },
  {
    title: "Nostr-native",
    description:
      "Use Nostr signatures to access your wallet, receive compatible zaps, and attach an optional NIP-05 name to your public key.",
    icon: KeyRoundIcon,
  },
  {
    title: "Open source",
    description:
      "Built on open protocols and published under the MIT License. Inspect the code, run your own instance, or contribute.",
    icon: Code2Icon,
  },
]

const walletIntegrations: WalletIntegration[] = [
  {
    name: "cashu.me",
    description:
      "A Cashu wallet for web and mobile, with npub.cash built in from the start.",
    highlights: [
      "Open it in any browser",
      "Native beta for iPhone and Android",
    ],
    icon: MonitorSmartphoneIcon,
    actions: [
      {
        label: "Open web wallet",
        href: "https://wallet.cashu.me/",
        primary: true,
      },
      {
        label: "Explore native apps",
        href: "https://cashu.me/",
      },
    ],
  },
  {
    name: "Sovran",
    description:
      "A native Bitcoin wallet that brings Cashu ecash, Lightning, Nostr, and npub.cash together.",
    highlights: [
      "Designed for iPhone",
      "Claim npub.cash payments inside the app",
    ],
    icon: SmartphoneIcon,
    actions: [
      {
        label: "Explore Sovran",
        href: "https://sovran.money/",
        primary: true,
      },
    ],
  },
  {
    name: "CDK CLI",
    description:
      "A command-line Cashu wallet with dedicated npub.cash support for developers and advanced users.",
    highlights: [
      "Built for terminal workflows",
      "Open source and powered by CDK",
    ],
    icon: TerminalIcon,
    actions: [
      {
        label: "View CDK CLI",
        href: "https://github.com/cashubtc/cdk/tree/main/crates/cdk-cli",
        primary: true,
      },
    ],
  },
]

const steps = [
  {
    number: "01",
    title: "Share your address",
    description:
      "Share npub1…@npub.cash, or claim a shorter username@npub.cash address.",
    detail: "Your address works immediately",
    icon: SendIcon,
  },
  {
    number: "02",
    title: "Receive over Lightning",
    description:
      "The sender's wallet resolves your address. npub.cash requests an invoice from your configured Cashu mint and watches the quote for payment.",
    detail: "Your device may stay offline",
    icon: ZapIcon,
  },
  {
    number: "03",
    title: "Claim the ecash",
    description:
      "When you return, open an integrated wallet and connect your Nostr signer. It finds your paid quotes and mints the corresponding Cashu ecash.",
    detail: "Use cashu.me, Sovran, or CDK",
    icon: CoinsIcon,
  },
]

const faqs = [
  {
    question: "Do I need to sign up?",
    answer:
      "No separate npub.cash account is required. Any valid Nostr npub can receive at npub1…@npub.cash. Use an integrated wallet and connect your Nostr signer when you want to manage payments.",
  },
  {
    question: "Can I really receive while offline?",
    answer:
      "Yes—the recipient's device can be offline. npub.cash requests and tracks the mint quote while the sender pays over Lightning. Your wallet claims the ecash after you reconnect.",
  },
  {
    question: "Where does the money live?",
    answer:
      "The Lightning payment goes to a quote from your configured Cashu mint. After payment, your wallet uses that paid quote to mint Cashu ecash. The mint is custodial, while the ecash is stored by your wallet after it is claimed.",
  },
  {
    question: "What does quote locking do?",
    answer:
      "If enabled and supported by your mint and wallet, NUT-20 locks the mint quote to your Nostr public key so redeeming it requires valid signatures. It is optional and off by default.",
  },
  {
    question: "What is a Cashu mint?",
    answer:
      "A Cashu mint issues and redeems private bearer ecash backed by its Lightning balance. Mints are custodial, so choose one you trust.",
  },
  {
    question: "Does npub.cash provide its own wallet?",
    answer:
      "No. npub.cash provides the Lightning address and coordinates paid mint quotes. Use an integrated wallet—cashu.me, Sovran, or the CDK CLI—to discover and claim your payments.",
  },
  {
    question: "Which wallet should I choose?",
    answer:
      "cashu.me is available in the browser and as native beta apps, Sovran is a native mobile option, and the CDK CLI is intended for developers and advanced command-line users.",
  },
  {
    question: "Are usernames required?",
    answer:
      "No. A username is an optional, human-readable alternative to your npub address and can also act as an NIP-05 identifier.",
  },
  {
    question: "Does npub.cash support Nostr zaps?",
    answer:
      "The hosted service currently advertises zap support. When Nostr support is enabled, the server validates zap requests and publishes zap receipts after payment.",
  },
]

function BrandMark() {
  return (
    <span
      className="brand-mark relative flex size-9 items-center justify-center rounded-xl text-primary-foreground [&_svg]:size-5"
      aria-hidden="true"
    >
      <WalletCardsIcon strokeWidth={2.2} />
      <ZapIcon className="absolute -right-1 -bottom-1 rounded-full bg-background p-0.5 text-primary" />
    </span>
  )
}

function Brand() {
  return (
    <a
      href="#top"
      className="flex items-center gap-2.5 rounded-lg font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      aria-label="npub.cash home"
    >
      <BrandMark />
      <span className="text-lg">npub.cash</span>
    </a>
  )
}

function SectionHeading({
  eyebrow,
  title,
  description,
  centered = false,
}: {
  eyebrow?: string
  title: string
  description: string
  centered?: boolean
}) {
  return (
    <div
      className={cn(
        "flex max-w-2xl flex-col gap-4",
        centered && "mx-auto items-center text-center"
      )}
    >
      {eyebrow ? <Badge variant="outline">{eyebrow}</Badge> : null}
      <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      <p className="text-base leading-7 text-pretty text-muted-foreground sm:text-lg">
        {description}
      </p>
    </div>
  )
}

function ExperimentalNotice() {
  return (
    <div className="border-b bg-muted/60">
      <Alert className="mx-auto max-w-7xl rounded-none border-0 px-4 py-2.5 sm:px-6 lg:px-8">
        <TriangleAlertIcon />
        <AlertTitle>Experimental software</AlertTitle>
        <AlertDescription>
          Use small amounts only. Cashu mints are custodial, and access to funds
          depends on the mint you use. <a href="#trust">Understand the risks</a>
        </AlertDescription>
      </Alert>
    </div>
  )
}

function Header() {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <a
          href="#top"
          className="rounded-lg text-lg font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label="npub.cash home"
        >
          npub.cash
        </a>

        <nav
          className="hidden items-center gap-1 md:flex"
          aria-label="Main navigation"
        >
          <a className={buttonVariants({ variant: "ghost" })} href="#top">
            Home
          </a>
          <a className={buttonVariants({ variant: "ghost" })} href="#wallets">
            Wallets
          </a>
          <a
            className={buttonVariants({ variant: "ghost" })}
            href="#how-it-works"
          >
            How it works
          </a>
          <a
            className={buttonVariants({ variant: "ghost" })}
            href={SOURCE_HREF}
            target="_blank"
            rel="noreferrer"
          >
            Source
            <ExternalLinkIcon data-icon="inline-end" />
          </a>
        </nav>
      </div>
    </header>
  )
}

function PaymentRoute() {
  return (
    <Card className="relative min-h-[30rem] shadow-2xl shadow-primary/10">
      <CardHeader>
        <CardTitle>Your payment route</CardTitle>
        <CardDescription>
          One address connects Lightning to Cashu ecash and your Nostr identity.
        </CardDescription>
        <CardAction>
          <span className="flex size-2.5">
            <span className="absolute inline-flex size-2.5 animate-ping rounded-full bg-primary opacity-50 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
          </span>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-center gap-5">
        <div className="rounded-xl border bg-muted/40 p-4">
          <span className="mb-2 block text-xs text-muted-foreground">
            Your Lightning address
          </span>
          <code className="block truncate text-sm font-semibold sm:text-base">
            npub1yourkey…@npub.cash
          </code>
        </div>

        <div className="relative grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2">
          <RouteNode icon={ZapIcon} label="Lightning" />
          <ArrowRightIcon
            className="text-muted-foreground"
            aria-hidden="true"
          />
          <RouteNode icon={LandmarkIcon} label="Mint" />
          <ArrowRightIcon
            className="text-muted-foreground"
            aria-hidden="true"
          />
          <RouteNode icon={WalletCardsIcon} label="Wallet" />
        </div>

        <div className="flex flex-col gap-3 rounded-xl border bg-background p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium">Quote paid</p>
              <p className="text-xs leading-5 text-muted-foreground">
                npub.cash keeps track of the paid mint quote.
              </p>
            </div>
          </div>
          <Separator />
          <div className="flex items-start gap-3">
            <RadioTowerIcon className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium">Ready when you are</p>
              <p className="text-xs leading-5 text-muted-foreground">
                Reconnect later and claim the ecash with your signer.
              </p>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter>
        <span className="text-xs text-muted-foreground">
          Recipient may be offline
        </span>
      </CardFooter>
    </Card>
  )
}

function RouteNode({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl border bg-background text-primary shadow-sm [&_svg]:size-5">
        <Icon />
      </span>
      <span className="truncate text-xs font-medium">{label}</span>
    </div>
  )
}

function Hero() {
  return (
    <section id="top" className="hero-grid relative overflow-hidden border-b">
      <div className="mx-auto grid min-h-[calc(100svh-7rem)] max-w-7xl items-center gap-14 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-[1.08fr_0.92fr] lg:px-8 lg:py-28">
        <div className="relative flex max-w-3xl flex-col items-start gap-7">
          <div className="flex flex-col gap-5">
            <h1 className="max-w-4xl text-5xl leading-[0.98] font-semibold tracking-[-0.045em] text-balance sm:text-6xl lg:text-7xl">
              A Nostr-native{" "}
              <span className="brand-gradient-text">Lightning address</span> for
              everyone
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-pretty text-muted-foreground sm:text-xl">
              Receive Lightning at npub1…@npub.cash—even while offline—then
              claim it as ecash in an integrated wallet.
            </p>
          </div>

          <p className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
            <BadgeCheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
            No separate npub.cash account. Your wallet connects your Nostr
            signer and keeps your ecash on your device.
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-xl lg:mx-0">
          <div className="pointer-events-none absolute -inset-12 rounded-full bg-primary/10 blur-3xl" />
          <PaymentRoute />
        </div>
      </div>
    </section>
  )
}

function Benefits() {
  return (
    <section className="border-b py-24 sm:py-28">
      <div className="mx-auto flex max-w-7xl flex-col gap-12 px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Your Nostr identity, now a Lightning address"
          description="npub.cash connects a familiar Lightning address to your Nostr public key and a Cashu mint, so payments can wait for you until your wallet is online."
        />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map(({ title, description, icon: Icon }) => (
            <Card key={title} className="h-full">
              <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
                <CardAction>
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary [&_svg]:size-5">
                    <Icon />
                  </span>
                </CardAction>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

function IntegratedWallets() {
  return (
    <section
      id="wallets"
      className="scroll-mt-24 border-b bg-muted/30 py-24 sm:py-28"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-12 px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Wallets that work with npub.cash"
          description="npub.cash is the Lightning address, not the wallet. Choose an independent integration below to find payments sent to your npub and claim them as ecash."
          centered
        />

        <div className="grid gap-4 lg:grid-cols-3">
          {walletIntegrations.map(
            ({
              name,
              description,
              highlights,
              icon: Icon,
              actions,
            }) => (
              <Card
                key={name}
                className="h-full [--card-spacing:--spacing(6)]"
              >
                <CardHeader>
                  <CardTitle>{name}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                  <CardAction>
                    <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary [&_svg]:size-5">
                      <Icon />
                    </span>
                  </CardAction>
                </CardHeader>
                <CardContent className="mt-auto">
                  <ul className="flex flex-col gap-3">
                    {highlights.map((highlight) => (
                      <li
                        key={highlight}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="flex-wrap gap-2">
                  {actions.map(({ label, href, primary }) => (
                    <a
                      key={label}
                      className={buttonVariants({
                        variant: primary ? "default" : "outline",
                      })}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {label}
                      <ExternalLinkIcon data-icon="inline-end" />
                    </a>
                  ))}
                </CardFooter>
              </Card>
            )
          )}
        </div>

        <Alert className="mx-auto max-w-3xl">
          <WalletCardsIcon />
          <AlertTitle>Independent wallets</AlertTitle>
          <AlertDescription>
            Each wallet is built and released by its own team, so availability
            may change. Start with small amounts while the integrations mature.
          </AlertDescription>
        </Alert>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-24 border-b bg-muted/30 py-24 sm:py-28"
    >
      <div className="mx-auto grid max-w-7xl gap-14 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
        <div className="flex flex-col items-start gap-8 lg:sticky lg:top-28 lg:self-start">
          <SectionHeading
            title="Receive now. Claim when you're ready."
            description="Lightning delivers the payment, a Cashu mint prepares the ecash, and your Nostr identity tells the wallet which paid quotes belong to you."
          />

          <Alert>
            <RadioTowerIcon />
            <AlertTitle>Built for asynchronous receiving</AlertTitle>
            <AlertDescription>
              Your device can be offline while the sender, npub.cash, Lightning,
              and the mint coordinate the payment.
            </AlertDescription>
          </Alert>
        </div>

        <ol className="relative flex flex-col gap-5 before:absolute before:top-10 before:bottom-10 before:left-6 before:w-px before:bg-border before:content-[''] sm:before:left-8">
          {steps.map(({ number, title, description, detail, icon: Icon }) => (
            <li key={number} className="relative pl-16 sm:pl-20">
              <span className="absolute top-6 left-0 flex size-12 items-center justify-center rounded-full border bg-background text-primary shadow-sm sm:size-16 [&_svg]:size-5 sm:[&_svg]:size-6">
                <Icon />
              </span>
              <Card>
                <CardHeader>
                  <Badge variant="secondary">Step {number}</Badge>
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2Icon className="size-4 text-primary" />
                    {detail}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function TrustModel() {
  const safetyPoints = [
    "Start with small amounts.",
    "Choose a mint you understand and trust.",
    "Back up wallet data or recovery material you are asked to protect.",
    "Quote locking requires compatible mint and wallet support.",
    "Experimental software can change or fail.",
  ]

  return (
    <section id="trust" className="scroll-mt-24 border-b py-24 sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div className="flex flex-col items-start gap-7">
          <SectionHeading
            eyebrow="Trust model"
            title="Know what you are trusting"
            description="Cashu ecash is issued by a mint, and that mint is a custodian. npub.cash coordinates the Lightning address and keeps the paid quote available for your wallet; it is not the Cashu mint."
          />
          <p className="max-w-2xl leading-7 text-muted-foreground">
            If your chosen mint and wallet support NUT-20, you can enable quotes
            locked to your Nostr public key. Locking is optional and is not
            enabled for every payment by default.
          </p>
          <a
            className={buttonVariants({ variant: "outline", size: "lg" })}
            href={SOURCE_HREF}
            target="_blank"
            rel="noreferrer"
          >
            Inspect the source
            <GitForkIcon data-icon="inline-end" />
          </a>
        </div>

        <Card>
          <CardHeader>
            <Badge variant="secondary">
              <ShieldCheckIcon data-icon="inline-start" />
              Safety first
            </Badge>
            <CardTitle>A clear trust boundary</CardTitle>
            <CardDescription>
              Keep these points in mind before receiving real value.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-4">
              {safetyPoints.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-primary" />
                  <span className="leading-6">{point}</span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <p className="text-xs leading-5 text-muted-foreground">
              npub.cash is not described as trustless or non-custodial because a
              Cashu mint holds the underlying Lightning balance.
            </p>
          </CardFooter>
        </Card>
      </div>
    </section>
  )
}

function UsernameCallout() {
  return (
    <section
      id="username"
      className="scroll-mt-24 border-b bg-muted/30 py-20 sm:py-24"
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <Card className="overflow-visible shadow-xl shadow-primary/5">
          <CardHeader>
            <Badge variant="secondary">
              <AtSignIcon data-icon="inline-start" />
              Optional username
            </Badge>
            <CardTitle>Prefer a name people can remember?</CardTitle>
            <CardDescription>
              Your npub address works without registration. Claim an available
              username for a shorter address and an optional NIP-05 identity.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="brand-panel flex flex-col items-start justify-between gap-4 rounded-xl p-5 sm:flex-row sm:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground [&_svg]:size-5">
                  <AtSignIcon />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    Easy to share
                  </p>
                  <code className="block truncate text-base font-semibold sm:text-lg">
                    yourname@npub.cash
                  </code>
                </div>
              </div>
              <Badge variant="outline">Also resolves through NIP-05</Badge>
            </div>
          </CardContent>
          <CardFooter className="flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <p className="text-xs leading-5 text-muted-foreground">
              Availability and price are shown before purchase. Payment uses
              Cashu ecash.
            </p>
            <a
              className={buttonVariants({ variant: "default", size: "lg" })}
              href="#wallets"
            >
              Choose a compatible wallet
              <ArrowRightIcon data-icon="inline-end" />
            </a>
          </CardFooter>
        </Card>
      </div>
    </section>
  )
}

function Faq() {
  return (
    <section className="border-b py-24 sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.7fr_1.3fr] lg:px-8">
        <SectionHeading
          title="A few things worth knowing"
          description="The short answers to how npub.cash receives, stores, and protects payments."
        />

        <Accordion>
          {faqs.map(({ question, answer }, index) => (
            <AccordionItem key={question} value={"faq-" + index}>
              <AccordionTrigger>{question}</AccordionTrigger>
              <AccordionContent className="max-w-2xl leading-6 text-muted-foreground">
                {answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="hero-grid relative overflow-hidden py-24 sm:py-28">
      <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-7 px-4 text-center sm:px-6 lg:px-8">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-xl shadow-primary/20 [&_svg]:size-8">
          <ZapIcon />
        </span>
        <div className="flex flex-col gap-4">
          <h2 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Your npub already has an address
          </h2>
          <p className="mx-auto max-w-2xl text-lg leading-8 text-pretty text-muted-foreground">
            Pick an integrated wallet, connect your Nostr signer, and claim
            Lightning payments sent to npub1…@npub.cash.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <a
            className={buttonVariants({ variant: "default", size: "lg" })}
            href="#wallets"
          >
            <WalletCardsIcon data-icon="inline-start" />
            Choose a wallet
          </a>
          <a
            className={buttonVariants({ variant: "outline", size: "lg" })}
            href="#how-it-works"
          >
            Read how it works
          </a>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-3">
            <Brand />
            <p className="text-sm text-muted-foreground">
              Built with Lightning, Cashu ecash, and Nostr.
            </p>
          </div>
          <nav className="flex flex-wrap gap-2" aria-label="Footer navigation">
            <a
              className={buttonVariants({ variant: "ghost" })}
              href={SOURCE_HREF}
              target="_blank"
              rel="noreferrer"
            >
              <GitForkIcon data-icon="inline-start" />
              Source
            </a>
            <a
              className={buttonVariants({ variant: "ghost" })}
              href={NOSTR_HREF}
              target="_blank"
              rel="noreferrer"
            >
              <RadioTowerIcon data-icon="inline-start" />
              Nostr
            </a>
            <a className={buttonVariants({ variant: "ghost" })} href="#trust">
              <TriangleAlertIcon data-icon="inline-start" />
              Experimental
            </a>
          </nav>
        </div>
        <Separator />
        <div className="flex flex-col justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
          <span>Open source under the MIT License.</span>
          <span>Receive while offline. Claim when ready.</span>
        </div>
      </div>
    </footer>
  )
}

export function App() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <a
        href="#main-content"
        className="fixed top-3 left-3 z-50 -translate-y-20 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-transform focus:translate-y-0"
      >
        Skip to content
      </a>
      <ExperimentalNotice />
      <Header />
      <main id="main-content">
        <Hero />
        <Benefits />
        <IntegratedWallets />
        <HowItWorks />
        <TrustModel />
        <UsernameCallout />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}

export default App
