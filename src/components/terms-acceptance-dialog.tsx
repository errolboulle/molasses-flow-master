import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  userId: string;
  onAccepted: () => void;
}

export function TermsAcceptanceDialog({ userId, onAccepted }: Props) {
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAccept = async () => {
    if (!agreed) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ terms_accepted_at: new Date().toISOString() })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      toast.error("Could not record acceptance: " + error.message);
      return;
    }
    toast.success("Thank you for accepting");
    onAccepted();
  };

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        className="max-w-2xl w-[calc(100vw-2rem)] p-0 gap-0 [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle>Terms & Conditions and Privacy Policy</DialogTitle>
          <DialogDescription>
            Please review and accept the following to continue using Flow Ops.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="terms" className="px-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="terms">Terms & Conditions</TabsTrigger>
            <TabsTrigger value="privacy">Privacy Policy</TabsTrigger>
          </TabsList>

          <TabsContent value="terms" className="mt-3">
            <ScrollArea className="h-[45vh] sm:h-[55vh] rounded-md border p-4">
              <TermsContent />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="privacy" className="mt-3">
            <ScrollArea className="h-[45vh] sm:h-[55vh] rounded-md border p-4">
              <PrivacyContent />
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="px-6 py-4 border-t bg-muted/30 flex flex-col gap-3">
          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <Checkbox
              checked={agreed}
              onCheckedChange={(v) => setAgreed(Boolean(v))}
              className="mt-0.5"
            />
            <span>I agree to the Terms & Conditions and Privacy Policy</span>
          </label>
          <Button onClick={handleAccept} disabled={!agreed || saving} className="w-full sm:w-auto sm:self-end">
            {saving ? "Saving…" : "Accept and Continue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="font-semibold text-foreground mb-2">{title}</h3>
      <div className="text-sm text-muted-foreground space-y-2 leading-relaxed">{children}</div>
    </section>
  );
}

function TermsContent() {
  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        These Terms & Conditions ("Terms") govern the use of the Molasses Storage Management Application
        ("Platform"). By accessing or using the Platform, you agree to these Terms.
      </p>

      <Section title="1. Services Provided">
        <p>The Platform provides tools for tracking molasses stock levels, recording inflows and outflows,
          monitoring storage facilities, generating reports and analytics, and managing users and operational data.</p>
        <p>We reserve the right to improve, modify, or discontinue features at any time.</p>
      </Section>

      <Section title="2. User Responsibilities">
        <p>You agree to provide accurate and complete data, maintain confidentiality of login credentials,
          use the system only for lawful business purposes, and ensure that all entries (stock, movement,
          readings) are correct. You are solely responsible for the accuracy of your data.</p>
      </Section>

      <Section title="3. Data Accuracy & Liability">
        <p>The Platform relies on user-input data. We do not guarantee accuracy of reports if incorrect data
          is entered. We are not liable for stock discrepancies, losses, or operational decisions made using
          the Platform.</p>
      </Section>

      <Section title="4. System Availability">
        <p>We aim for high uptime but do not guarantee uninterrupted access. We are not responsible for
          downtime, internet/network issues, or third-party service failures.</p>
      </Section>

      <Section title="5. Intellectual Property">
        <p>All software, design, and content belong to us. You may not copy, resell, or redistribute the Platform.</p>
      </Section>

      <Section title="6. Subscription & Payments">
        <p>Access may require a paid subscription. Fees are billed as agreed (monthly or annually).
          Non-payment may result in suspension. All payments are non-refundable unless required by law.</p>
      </Section>

      <Section title="7. Termination">
        <p>We may suspend or terminate access if Terms are violated, misuse or fraud is detected, or payment
          is not made. Users may stop using the Platform at any time.</p>
      </Section>

      <Section title="8. Limitation of Liability">
        <p>To the fullest extent allowed by law, we are not liable for indirect, incidental, or consequential
          damages. Liability is limited to the amount paid for the service.</p>
      </Section>

      <Section title="9. Governing Law">
        <p>These Terms are governed by the laws of South Africa.</p>
      </Section>

      <Section title="10. Updates to Terms">
        <p>We may update these Terms at any time. Continued use means acceptance of updates.</p>
      </Section>
    </div>
  );
}

function PrivacyContent() {
  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        This Privacy Policy explains how the Molasses Storage Management Application handles your information.
      </p>

      <Section title="1. Information We Collect">
        <p>Business details (company name, location), user details (name, email), operational data
          (stock levels, logs, tank data), and usage data (app activity, login info).</p>
      </Section>

      <Section title="2. How We Use Information">
        <p>To provide and improve the Platform, generate reports and analytics, maintain system security,
          and communicate with users.</p>
      </Section>

      <Section title="3. Data Ownership">
        <p>You own your data. We act only as a data processor. We do not sell your data to third parties.</p>
      </Section>

      <Section title="4. Data Security">
        <p>We implement reasonable measures to protect data, but no system is 100% secure. You are responsible
          for protecting your login credentials.</p>
      </Section>

      <Section title="5. Data Sharing">
        <p>We only share data when required by law, with trusted service providers (hosting, payments),
          or with your permission.</p>
      </Section>

      <Section title="6. Data Retention">
        <p>We retain data as long as your account is active or as required by law. You may request deletion
          of your data.</p>
      </Section>

      <Section title="7. Cookies & Tracking">
        <p>We may use basic tracking for performance, analytics, and improving user experience.</p>
      </Section>

      <Section title="8. User Rights">
        <p>You may request access to your data, request corrections, or request deletion (where applicable).</p>
      </Section>

      <Section title="9. Changes to Policy">
        <p>We may update this policy. Continued use means acceptance.</p>
      </Section>
    </div>
  );
}
