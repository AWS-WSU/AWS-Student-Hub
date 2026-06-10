# Contributing

Thanks for contributing to AWS Student Hub. Keep changes focused, document anything that affects setup or deployment, and open a pull request when the work is ready for review.

## Before you start

1. Read the [development setup](docs/development.md).
2. Create a branch from the active development branch.
3. Use a clear branch name, such as `feature/event-filters` or `fix/profile-upload`.

## Contribution flow

```bash
git checkout -b feature/your-change
# make your changes
git add <files>
git commit -m "type: short description"
git push origin feature/your-change
```

Use concise commit messages:

```txt
fix: preserve profile image crop
feat: add event reminder emails
chore: update backend logging
```

## Pull requests

A good pull request includes:

- What changed
- Why it changed
- Any setup or migration notes
- Screenshots or screen recordings for UI changes
- The validation you ran, if applicable

## Visual guide

### Create a branch in your editor

Open the project in VS Code or a similar editor, then select the current branch from the lower-left status bar.

<img width="491" alt="Branch selection in VS Code" src="https://github.com/user-attachments/assets/5ffd0feb-37e8-4765-ab4f-891b9848b4dc" />

Choose **Create a new branch** and name it after the change you are making.

<img width="595" alt="Create new branch dialog" src="https://github.com/user-attachments/assets/79669ab4-93ba-48e2-a0db-3787409827c5" />

### Make and commit changes

After making changes, use the source-control panel to review and stage them.

<img width="217" alt="Branch icon in IDE" src="https://github.com/user-attachments/assets/5c409b6e-7348-47c6-87a9-65598d2d8c2e" />

Click the commit action after staging your files.

<img width="216" alt="Commit changes button" src="https://github.com/user-attachments/assets/96970816-f5a2-43a0-b43e-2b252d312055" />

Enter a short, descriptive commit message.

<img width="592" alt="Commit message dialog" src="https://github.com/user-attachments/assets/ca35741a-8a9f-4f90-96e4-4d638207ed06" />

### Push and open a pull request

Push your branch to GitHub.

<img width="218" alt="Push changes icon" src="https://github.com/user-attachments/assets/e00650af-e9ba-4afc-90e7-6b581ac552bd" />

Then open a pull request from the GitHub prompt.

<img width="960" alt="Pull request notification" src="https://github.com/user-attachments/assets/37e929ee-7430-4608-9001-8351b7d9678d" />
