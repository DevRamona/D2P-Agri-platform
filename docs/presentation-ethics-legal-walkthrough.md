# IsokoLink Presentation Notes for Ethics and Legal Requirements

Use these notes when recording the required video walkthrough. The app now has a dedicated legal page at `/legal`, and this outline helps you explain it in a clear, natural way.

## 0. Academic project standard

To keep this at a strong academic standard, present the legal page as:

- a transparent description of the current prototype, not as a claim of full production compliance;
- a user-facing explanation written in plain language;
- a project artefact that matches the actual implementation in the app and backend;
- a piece of ethical documentation that supports accountability, not just a formality.

You can briefly say:

"This legal page is written for the current academic prototype. It explains what the system does now, what data it uses, and what limits still apply."

## 1. Historical context and design evolution

Start with a short history of the kind of technology this project belongs to:

- Agricultural trade used to rely mostly on face-to-face negotiation, paper records, local trust, and manual crop inspection.
- Mobile phones and digital payments changed that by making remote coordination and mobile money possible.
- More recently, computer vision and generative AI added another layer: farmers can upload crop images and get quick decision support, but that creates new issues around accuracy, privacy, and over-trust in automated output.

Then connect that history to this project:

- IsokoLink started as a marketplace for farmers, buyers, and administrators.
- The design later expanded into escrow tracking, payment integration, and a crop-disease scanner.
- That changed the ethical questions in the project. A marketplace mainly deals with identity, price, and logistics. The scanner adds image processing, model uncertainty, and optional third-party AI recommendation tools.

## 2. Current and intended uses

Explain the system in terms of what users actually do:

- Farmers create accounts, list produce, create batches, and track earnings and deliveries.
- Buyers browse batches, place orders, and follow escrow-supported checkout and tracking.
- Administrators handle disputes, escrow activity, and operational issues.
- The crop scanner is meant to support maize and bean farmers in Rwanda, not replace a real agronomic diagnosis.

Then say clearly what the project is trying to do:

- Intended benefit: faster access to information, better trade coordination, and earlier response to crop disease signs.
- Intended limit: users still need human judgement for treatment decisions, dispute handling, and safety-critical cases.

## 3. User impact, inclusivity, and exclusion

Discuss both positive impact and possible exclusion.

Positive impact:

- Faster access to market information and order tracking can improve trust between farmers and buyers.
- The crop scanner may help farmers notice problems earlier.
- Recommendations can be shown in English and Kinyarwanda, which improves access for some users.
- The interface is designed for mobile use, which matters in contexts where phones are the main access point.

Possible exclusion or unequal impact:

- Users without smartphones, stable internet, cameras, or affordable data may be left out of the scanner workflow.
- Farmers who grow crops outside the maize and bean focus may not benefit much from this version.
- Users with low literacy or low digital confidence may still struggle.
- If model accuracy changes with image quality, region, or disease type, some users may get weaker support than others.
- Users may trust the interface more than they should when the model is actually uncertain.

## 4. Ethical issues already present or reasonably anticipated

Address the main ethical issues directly:

- Accuracy and over-reliance: users may treat AI output like a final answer when it is only a prediction.
- Privacy: the system handles account details, trade records, and crop images, which can reveal farm conditions and economic vulnerability.
- Third-party transfer: recommendations and payments may involve outside providers, so data does not stay in one place.
- Consent and future research use: crop images should not quietly become training data later on.
- Fairness and inclusion: if the model works better for some users than others, the benefits will not be shared equally.
- Accountability: when something goes wrong, responsibility must still be traceable to people and system operators.
- Security: accounts, tokens, and payment metadata create real risk even in a student prototype.

## 5. Mandatory legal-page walkthrough in the video

In the recording, open the in-app page at `/legal`. You can reach it from the header button called `Legal & Privacy` or from the welcome page button called `Review legal and privacy terms`.

Walk through the page in this order:

1. Say that the page brings the EULA and Privacy Policy into one clear place inside the app.
2. Open the EULA section and summarise each clause:
   - Acceptance and scope: explain what this prototype is and what using it means.
   - Accounts and security: explain why users need to register properly and protect their login details.
   - AI assistance limits: explain that crop results are advisory, not final.
   - Payments and third-party providers: explain that payment responsibility is shared with outside services.
   - Acceptable use: explain why the app needs rules against abuse, fraud, and misleading uploads.
   - Availability and suspension: explain that the app can change, fail, or be paused.
3. Open the Privacy Policy section and summarise each clause:
   - What data is collected: account, order, payment, image, and location-context data.
   - How data is used: login, marketplace operations, inference, and recommendations.
   - Third-party processing: explain where data may leave the main app.
   - Storage and retention: explain the privacy-first defaults, especially that crop images are not stored by default in this build.
   - User rights and control: explain what users can still request or control in a prototype.
   - Security and research reuse: explain that user data is not automatically turned into research data.

## 6. What to say about why the clauses matter

Do not just read the headings. For each clause, briefly explain why it matters:

- For users: it affects trust, safety, and control.
- For developers: it creates real implementation responsibilities.
- For researchers: it limits reuse of data unless there is separate consent.
- For system operation: it connects the written policy to storage, access control, APIs, and failure handling.

## 7. Closing line

End with a short evaluative statement:

"This page matters because it tells users what the system does, what it does not do, what data it uses, and where human responsibility still matters."

## 8. Quick rubric check

Before recording, make sure your video clearly includes all of the following:

- historical context of the technology or concept;
- design evolution of this project;
- current and intended uses of the system;
- likely user impact;
- inclusivity and possible exclusion;
- ethical issues already present or reasonably expected;
- navigation to the legal page inside the app;
- a walkthrough of the major EULA clauses;
- a walkthrough of the major Privacy Policy clauses;
- an explanation of why those clauses matter for users, developers, researchers, and system operation.
